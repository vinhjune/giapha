# Thiết kế: Quản lý User & Phân quyền (Admin/Editor)

**Ngày:** 2026-08-02
**Trạng thái:** Đã duyệt

---

## 1. Tổng quan

Hiện tại app chạy trên **Cloudflare Worker (Hono) + D1 SQLite (Drizzle ORM)**, không có backend riêng, không có xác thực (auth đã bị gỡ trong lần migrate trước). Tài liệu này thiết kế việc thêm lại xác thực + phân quyền 2 cấp: **admin** và **editor**, cùng với luồng "editor request → admin duyệt" cho các thao tác ghi dữ liệu của editor.

**Bối cảnh quan trọng:**
- `worker/src/db/schema.ts` có comment cảnh báo DB share với project `giaphadongho` — đã xác nhận với chủ repo: `giaphadongho` là project cũ, đã nghỉ, không còn dùng chung DB. Có thể sửa schema tự do.
- Repo chưa có drizzle-kit migration setup (không `drizzle.config.ts`, không thư mục migrations). Áp dụng schema mới bằng file SQL thô chạy thủ công qua `wrangler d1 execute`.
- Trang chủ tương lai (landing page giới thiệu dòng họ, quy ước, sự kiện...) không thuộc phạm vi spec này.

**Yêu cầu nghiệp vụ chính:**
1. Bảng `users` riêng: `id`, `username`, `password` (hash), `role`, `email`, FK 1-1 tới `persons`.
2. **admin**: toàn quyền, bao gồm quản lý user và mọi quyền của editor.
3. **editor**: có quyền thêm/sửa/xóa thành viên (như hiện tại), nhưng mọi thao tác ghi đều tạo "editor request", chỉ áp dụng sau khi admin duyệt.
4. **Chưa đăng nhập (anonymous)**: chỉ xem Cây, xem Danh sách, bật/tắt hiển thị Đời. Mọi chức năng khác ẩn hoàn toàn cho đến khi đăng nhập.
5. Đăng nhập qua **modal** (không phải trang riêng), mở từ 1 mục trong Navbar.
6. **Control Panel** (route `/control-panel`, chỉ admin/editor): nơi duy nhất thực hiện Quản lý thành viên, Nhập/Xuất CSV (chỉ admin), Quản lý User (chỉ admin), và Duyệt yêu cầu.

---

## 2. Data model & Migration

### Sửa bảng `users` (thêm cột, giữ tương thích ngược)
```sql
ALTER TABLE users ADD COLUMN email TEXT;
```
- `role` (tầng Drizzle/TS) mở rộng thành `'admin' | 'editor' | 'viewer'`. SQLite không ép enum bằng CHECK constraint ở bảng hiện tại nên không cần ALTER cho việc này — chỉ cập nhật type TypeScript trong `schema.ts`.
- `viewer` giữ lại trong enum để dùng sau này (tài khoản đăng nhập nhưng chỉ xem, quyền y hệt anonymous + được xuất CSV — **đã đổi**: xuất CSV giờ chỉ dành cho admin, xem mục 3, nên viewer hiện quyền y hệt anonymous). UI tạo/sửa user cho chọn cả 3 role ngay từ đầu.
- `personId`: giữ nguyên, nullable, unique, FK → `persons(id)` ON DELETE SET NULL. Không bắt buộc khi tạo user; Control Panel có chức năng gắn thành viên sau.

### Bảng mới `sessions`
```sql
CREATE TABLE sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### Bảng mới `editor_requests`
```sql
CREATE TABLE editor_requests (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('create','update','delete')),
  person_id TEXT REFERENCES persons(id) ON DELETE CASCADE, -- NULL nếu type=create (thành viên chưa tồn tại)
  payload TEXT, -- JSON PersonPayload; NULL nếu type=delete
  submitted_by TEXT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at TEXT,
  resolved_by TEXT REFERENCES users(id)
);

-- Chặn nhiều request pending cùng lúc trên 1 thành viên.
-- Request type=create có person_id NULL nên không bị chặn lẫn nhau (SQLite: nhiều NULL không trùng nhau trong unique index).
CREATE UNIQUE INDEX editor_requests_pending_person_idx
  ON editor_requests(person_id) WHERE status = 'pending' AND person_id IS NOT NULL;
```

Lưu thành `worker/migrations/0001_add_auth_and_requests.sql`. Áp dụng thủ công:
```bash
wrangler d1 execute giapha-db --local  --file=worker/migrations/0001_add_auth_and_requests.sql
wrangler d1 execute giapha-db --remote --file=worker/migrations/0001_add_auth_and_requests.sql
```
Không đụng đến `persons`, `families`, `familyMembers`, `events`, `settings`.

---

## 3. Backend: Auth & Authorization

**Mật khẩu:** PBKDF2-SHA256 qua Web Crypto (`crypto.subtle`, có sẵn trong Workers runtime, không cần thêm dependency). Lưu dạng chuỗi `pbkdf2:100000:<saltHex>:<hashHex>`.

**Session:** Cookie `giapha_session` (httpOnly, Secure, SameSite=Lax, hạn 30 ngày), giá trị là token ngẫu nhiên lưu trong bảng `sessions`. Middleware Hono đọc cookie mỗi request, tra `sessions` join `users`, gắn `c.set('user', {id, username, email, role, personId})` nếu hợp lệ; xóa cookie nếu token không tồn tại/hết hạn.

**Endpoints mới** (`worker/src/routes/auth.ts`):

| Endpoint | Điều kiện gọi | Việc làm |
|---|---|---|
| `GET /api/auth/me` | công khai | `{ user: null, setupNeeded: boolean }` hoặc `{ user: {...}, setupNeeded: false }` |
| `POST /api/auth/setup` | chỉ khi bảng `users` rỗng | Tạo tài khoản admin đầu tiên (username/password/email), tự động tạo session |
| `POST /api/auth/login` | công khai | Xác thực username-hoặc-email + password, tạo session, set cookie |
| `POST /api/auth/logout` | đã đăng nhập | Xóa session record + clear cookie |

**Authorization — bảng phân quyền theo route:**

| Route | Anonymous | viewer | editor | admin |
|---|---|---|---|---|
| `GET /api/tree`, `GET /api/avatars/*` | ✅ | ✅ | ✅ | ✅ |
| `GET /api/export/csv` | ❌ 401 | ❌ 403 | ❌ 403 | ✅ |
| `POST /api/import/csv` | ❌ | ❌ | ❌ 403 | ✅ |
| `POST/PUT/DELETE /api/persons*`, avatar upload | ❌ 401 | ❌ 403 | ✅ → tạo `editor_request` (không ghi trực tiếp) | ✅ → ghi trực tiếp như hiện tại |
| `GET/POST/PUT/DELETE /api/users*` | ❌ | ❌ | ❌ | ✅ |
| `GET /api/requests` | ❌ | ❌ | ✅ (chỉ request của mình) | ✅ (tất cả) |
| `POST /api/requests/:id/approve\|reject` | ❌ | ❌ | ❌ | ✅ |

`viewer` là role tài khoản đăng nhập (không phải anonymous), hiện tại có quyền y hệt anonymous (dự trữ cho tương lai).

---

## 4. Editor request/approval workflow

**Khi editor gửi thêm/sửa/xóa thành viên** (qua `POST/PUT/DELETE /api/persons...`):
1. Validate payload như hiện tại (hoTen bắt buộc, v.v.), nhưng **không ghi vào `persons/families/familyMembers`**.
2. Kiểm tra chưa có request `pending` khác cho `person_id` này → nếu có, trả lỗi 409 "Đã có yêu cầu khác đang chờ duyệt cho thành viên này".
3. Ghi 1 dòng vào `editor_requests` (`type`, `person_id`, `payload` = JSON body, `submitted_by`).
4. Trả `{ pending: true, requestId }` thay vì `{ id }`/`{ ok: true }`.

Khi `role === 'admin'`: giữ nguyên hành vi hiện tại (ghi trực tiếp, không qua `editor_requests`).

**Admin approve** (`POST /api/requests/:id/approve`):
- Refactor `editor.ts`: tách logic ghi dữ liệu hiện có trong 3 handler (`POST/PUT/DELETE /persons`) thành các hàm nội bộ dùng chung (`createPersonRecord`, `updatePersonRecord`, `deletePersonRecord`), gọi từ cả đường admin-trực-tiếp và đường approve-request.
- `type=create`: tạo person mới, cập nhật lại `person_id` của request thành id vừa tạo.
- `type=update`/`delete`: áp dụng lên person đã có.
- Đánh dấu `status=approved`, `resolved_by`, `resolved_at`.

**Admin reject** (`POST /api/requests/:id/reject`): chỉ đổi `status=rejected` + `resolved_by/resolved_at`, không đụng dữ liệu person. Không cần nhập lý do.

**Hiển thị "đang chờ duyệt":**
- `GET /api/tree` trả thêm `pendingRequestId?: string` cho mỗi Person có request `pending` type update/delete nhắm vào.
- `GET /api/requests` trả danh sách riêng (gồm cả request `type=create` đang pending, vì các thành viên này chưa tồn tại trong `persons` nên không gắn được badge lên cây).
- Badge chỉ hiển thị khi người xem đã đăng nhập là admin/editor (`useAuthStore().user !== null`).

---

## 5. Frontend integration

**Đăng nhập → Modal (không phải route riêng):**
- `LoginModal.tsx` (pattern giống `CsvImportModal.tsx`), mở từ mục **"Đăng nhập"** trong dropdown Navbar (☰).
- Tự động hiển thị đúng biến thể: form đăng nhập bình thường, hoặc "Tạo tài khoản Admin đầu tiên" nếu `GET /api/auth/me` trả `setupNeeded: true`.
- Đăng nhập/tạo admin thành công → đóng modal, cập nhật `useAuthStore`, không điều hướng.
- `App.tsx` thêm route `/control-panel` (page thật, nhiều tab/bảng nên không hợp làm modal). Không có route `/login`.

**`useAuthStore` (zustand) mới:**
```ts
{ user: {id, username, email, role, personId} | null, setupNeeded: boolean,
  checkAuth(), login(usernameOrEmail, password), logout(), setupFirstAdmin(...) }
```
`checkAuth()` gọi 1 lần khi app khởi động, song song với `loadData()` trong `App.tsx`.

**Navbar:**
- Ẩn danh: dropdown chỉ có "Chế độ xem" + "Thứ tự đời" + mục "Đăng nhập" (mở `LoginModal`).
- Đã đăng nhập: dropdown có thêm "Control Panel"; vùng navbar hiển thị username + badge role + "Đăng xuất". Bỏ "Quản lý thành viên"/"Nhập CSV"/"Xuất CSV" khỏi dropdown (chuyển vào Control Panel).
- FAB "+" và click-để-sửa trên Tree/List: chỉ hoạt động khi `user !== null`. Anonymous/`viewer` click vào thành viên → panel chi tiết read-only (không phải `PersonForm`), không nút sửa/xóa, không FAB.

**Control Panel (`/control-panel`, route được bảo vệ):**
- `user === null` sau khi `checkAuth()` xong → redirect về trang chính.
- Tab theo role: editor thấy **Thành viên**, **Yêu cầu của tôi**; admin thấy thêm **Yêu cầu chờ duyệt**, **CSV**, **Quản lý User**.
- Tab **Thành viên**: tái sử dụng `MemberManagementView`; với `role==='editor'`, "Áp dụng thay đổi" nhận `{pending:true}` → toast "Đã gửi yêu cầu, chờ admin duyệt", đánh dấu badge lên dòng vừa gửi thay vì cập nhật ngay.
- Tab **Yêu cầu chờ duyệt/Yêu cầu của tôi**, **CSV**, **Quản lý User**: component mới `PendingRequestsPanel`, `CsvPanel` (chuyển logic từ `CsvImportModal`/`exportCsv` vào đây), `UserManagementPanel`.

**Badge "Đang chờ duyệt":** thêm `pendingRequestId?: string` vào `Person` (client type) từ `GET /api/tree`; render trong `PersonCard`, dòng `ListView`, dòng `MemberManagementView` khi có giá trị này **và** `user !== null`.

**Mockup đã duyệt** (tham khảo khi implement, lưu tại phiên làm việc, không commit vào repo):
- Control Panel (desktop/mobile), Navbar (anonymous/logged-in), badge "Đang chờ duyệt", so sánh read-only vs editable.
- Lưu ý: mockup ban đầu có login dạng landing page riêng — **đã bác bỏ**, chốt là modal như mô tả trên.

---

## 6. Testing plan

**Backend (Vitest, theo pattern test hiện có trong `worker/`):**
- Auth: hash/verify mật khẩu đúng-sai; login thành công/sai mật khẩu/sai username; `setup` chỉ chạy khi `users` rỗng, chặn gọi lại lần 2; session hết hạn bị từ chối; logout xóa session.
- Authorization middleware: mỗi route trong bảng phân quyền test đủ 4 vai trò (anonymous/viewer/editor/admin), đúng mã lỗi/hành vi.
- Editor request flow: editor tạo/sửa/xóa → ghi `editor_requests`, không đụng `persons`; admin approve → dữ liệu ghi đúng (tái dùng test case hiện có của `editor.ts` qua đường approve); admin reject → dữ liệu không đổi, `status=rejected`.
- Ràng buộc unique pending-per-person: request thứ 2 cho cùng person đang pending → 409.
- CSV import/export: admin-only (test 403 cho editor/viewer/anonymous).

**Frontend (Vitest + Testing Library, theo pattern `*.test.tsx` hiện có):**
- `LoginModal`: đúng biến thể theo `setupNeeded`, báo lỗi sai mật khẩu, đóng modal sau khi login thành công.
- `Navbar`: dropdown item đúng theo trạng thái auth (ẩn danh/admin/editor).
- `MemberManagementView` trong Control Panel: editor bấm "Áp dụng thay đổi" → toast pending, dữ liệu hiển thị không đổi ngay; admin bấm → đổi ngay như hiện tại.
- Badge "Đang chờ duyệt": chỉ render khi có `pendingRequestId` và `user !== null`.
- Route guard `/control-panel`: `user === null` bị điều hướng ra ngoài.
