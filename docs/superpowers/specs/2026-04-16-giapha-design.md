# Thiết kế ứng dụng Quản lý Gia Phả

**Ngày:** 2026-04-16  
**Trạng thái:** Đã duyệt

---

## 1. Tổng quan

Ứng dụng web quản lý gia phả dòng họ, chạy hoàn toàn trên trình duyệt (không cần server). Dữ liệu lưu trên Google Drive của chủ dòng họ. Dùng được trên cả web lẫn điện thoại (responsive).

**Constraints:**
- Không cần server (hoặc chỉ dùng dịch vụ miễn phí)
- Tận dụng tối đa Google services (Drive, Identity)
- Giao diện tiếng Việt

---

## 2. Kiến trúc

```
GitHub Pages (static hosting)
  └─ React 18 + TypeScript + Vite (SPA)
       ├─ Google Identity / OAuth 2.0  →  xác thực người dùng
       └─ Google Drive API v3          →  đọc/ghi giapha/giapha.json
```

- **Không có backend.** Toàn bộ logic xử lý trong trình duyệt.
- **Deploy:** GitHub Actions tự động deploy lên GitHub Pages khi push lên `main`.
- **Mobile:** Responsive UI, dùng được trên điện thoại không cần cài app native.

---

## 3. Tech Stack

| Hạng mục | Thư viện / Công cụ |
|---|---|
| Framework | React 18 + TypeScript + Vite |
| Tree diagram | `relatives-tree` + `react-d3-tree` |
| UI / Styling | Tailwind CSS |
| Google Auth | `@react-oauth/google` (OAuth2 PKCE, không cần backend) |
| Google Drive | Google Drive API v3 (REST, gọi trực tiếp qua fetch) |
| State | Zustand |
| Routing | React Router v6 |
| Deploy | GitHub Actions → GitHub Pages |

---

## 4. Lưu trữ dữ liệu

### Vị trí file
Một file JSON duy nhất lưu tại `giapha/giapha.json` trong Google Drive của chủ dòng họ (admin).

### Cấu trúc `giapha.json`

```json
{
  "metadata": {
    "tenDongHo": "Dòng họ Nguyễn - Làng X",
    "phienBan": 1,
    "ngayCapNhat": "2026-04-16T10:30:00Z",
    "nguoiCapNhat": "admin@gmail.com",
    "cheDoXem": "private",
    "danhSachQuyen": [
      { "email": "admin@gmail.com", "quyen": "admin" },
      { "email": "editor@gmail.com", "quyen": "editor" },
      { "email": "viewer@gmail.com", "quyen": "viewer" }
    ],
    "dangChinhSua": null
  },
  "nguoi": [ /* mảng Person */ ]
}
```

### Cấu trúc Person

```json
{
  "id": "uuid-...",
  "hoTen": "Nguyễn Văn An",
  "gioiTinh": "nam",
  "ngaySinh": "1950-01-15",
  "ngayMat": null,
  "diaChiLienLac": "Hà Nội",
  "ghiChu": "",
  "thuTuTrongGiaDinh": 1,
  "laThanhVienHo": true,
  "idBo": "uuid-cha",
  "idMe": "uuid-me",
  "cacHonNhan": [
    {
      "idVoChong": "uuid-...",
      "thuTu": 1,
      "ngayKetHon": "1975-06-01",
      "ngayLyHon": null
    }
  ]
}
```

**Quy tắc dữ liệu:**
- `laThanhVienHo = false`: người ngoài họ (vợ/chồng, con gái đã lấy chồng, con của người nữ trong họ thuộc đời tiếp theo)
- Cây gia phả chỉ phát triển đến đời con của người nữ trong họ; đời cháu trở đi thuộc họ nhà chồng
- `thuTuTrongGiaDinh`: thứ tự anh chị em (1 = anh/chị cả)
- `cacHonNhan`: danh sách theo thứ tự thời gian; `thuTu` là vợ/chồng thứ mấy

---

## 5. Xác thực & Phân quyền

### Đăng nhập
- Người dùng đăng nhập bằng tài khoản Google (OAuth2 PKCE, popup).
- App đọc `giapha.json` từ Drive của admin, kiểm tra email trong `danhSachQuyen`.

### Phân quyền

| Quyền | Xem | Thêm/Sửa/Xóa người | Quản lý quyền | Đổi chế độ public/private |
|---|---|---|---|---|
| **admin** | ✅ | ✅ | ✅ | ✅ |
| **editor** | ✅ | ✅ | ❌ | ❌ |
| **viewer** | ✅ | ❌ | ❌ | ❌ |
| **(chưa đăng nhập — chế độ public)** | ✅ | ❌ | ❌ | ❌ |

### Chế độ public/private
- **Private (mặc định):** Phải đăng nhập và có trong `danhSachQuyen`.
- **Public:** Bất kỳ ai có link đều xem được, không cần đăng nhập. Chỉ admin mới bật/tắt.

---

## 6. Giao diện

### Layout chính (Desktop)
- **Navbar:** Logo + tên dòng họ | thanh tìm kiếm | toggle Cây/Danh sách | thông tin user
- **Vùng chính:** Cây gia phả (zoom, kéo thả) hoặc danh sách phân tầng
- **Panel phải:** Chi tiết người được chọn (tên, ngày sinh/mất, bố/mẹ, vợ/chồng, con cái, địa chỉ, ghi chú)

### Mobile
- Navbar thu gọn: icon tìm kiếm + icon menu
- Mặc định hiện danh sách phân tầng (cây diagram chuyển sang tab riêng)

### Hiển thị phân biệt
- **Người trong họ** (`laThanhVienHo = true`): màu xanh đậm, bo góc thường
- **Người ngoài họ** (`laThanhVienHo = false`): màu xám, viền đứt nét

### Chuyển đổi chế độ xem
- Toggle **Cây** ↔ **Danh sách** ở navbar, lưu preference vào localStorage.

---

## 7. Tính năng Tìm kiếm

- Tìm kiếm theo **tên** (client-side, không cần server).
- Thanh tìm kiếm ở navbar, tìm realtime khi gõ.
- **1 kết quả:** Tự động focus/highlight người đó trên cây hoặc danh sách.
- **Nhiều kết quả:** Hiện danh sách dropdown; click từng item để focus vào vị trí tương ứng.
- **Không có kết quả:** Hiện thông báo "Không tìm thấy".

---

## 8. Form Thêm / Chỉnh sửa người

Form hiện dạng **modal overlay** (không chuyển trang).

**Các trường:**
- Họ và tên *(bắt buộc)*
- Giới tính *(bắt buộc)*: toggle Nam / Nữ
- Con thứ (số thứ tự trong gia đình)
- Ngày sinh, Ngày mất (tùy chọn)
- Thuộc họ / Ngoài họ: toggle

**Quan hệ cha mẹ:**
- Chọn bố và mẹ qua modal phụ có tìm kiếm theo tên.
- **Auto-fill:** Khi chọn bố → tự động điền mẹ = vợ của bố (nếu bố chỉ có 1 vợ). Nếu bố có nhiều vợ → hiện dropdown inline để chọn vợ nào là mẹ. Logic đối xứng khi chọn mẹ trước.

**Hôn nhân:**
- Danh sách hôn nhân có thể thêm nhiều vợ/chồng.
- Mỗi hôn nhân: chọn vợ/chồng (qua modal phụ), ngày kết hôn (tùy chọn), ngày ly hôn/mất (tùy chọn).

**Địa chỉ liên lạc, Ghi chú** (tùy chọn).

---

## 9. Google Drive Integration

### OAuth Scopes
- **Admin + Editor:** `https://www.googleapis.com/auth/drive` — đọc và ghi file được chia sẻ. Không có scope nào hẹp hơn cho phép ghi vào file cụ thể theo File ID mà không dùng Google Picker.
- **Viewer:** `https://www.googleapis.com/auth/drive.readonly` — chỉ đọc file được chia sẻ.
- **Chế độ public (chưa đăng nhập):** Không cần OAuth — đọc file qua API key (file phải được chia sẻ "Anyone with the link can view" trên Drive).

### File ID trong app config
File ID của `giapha.json` được lưu trong biến môi trường lúc deploy (`VITE_GIAPHA_FILE_ID`). Admin cấu hình 1 lần duy nhất khi setup. Tất cả user dùng chung File ID này.

### Lần đầu dùng (Admin setup)
1. Admin đăng nhập → app yêu cầu `drive` scope.
2. App tạo thư mục `giapha/` và file `giapha.json` trên Drive của admin, lấy File ID.
3. Admin điền File ID vào GitHub repository secret (`VITE_GIAPHA_FILE_ID`), trigger redeploy.
4. Admin chia sẻ file trên Drive với từng editor/viewer theo email (để họ đọc được bằng `drive.readonly`).
5. Với chế độ public: Admin bật "Anyone with the link can view" trên Drive file + bật `cheDoXem: "public"` trong app.

### Đọc dữ liệu
- Dùng Drive API v3: `GET /drive/v3/files/{fileId}?alt=media`
- Cache vào `sessionStorage` để dùng offline (read-only).

### Ghi dữ liệu (admin / editor)
1. Đọc lại file từ Drive để lấy `phienBan` mới nhất (kiểm tra conflict).
2. Tăng `phienBan` lên 1, cập nhật `ngayCapNhat` và `nguoiCapNhat`.
3. `PATCH /upload/drive/v3/files/{fileId}` với nội dung JSON mới.

---

## 10. Xử lý lỗi & Conflict

### Conflict detection
- Trước khi lưu, app so sánh `phienBan` hiện tại trên Drive với `phienBan` lúc mở.
- Nếu khác nhau → cảnh báo: *"Dữ liệu đã được cập nhật bởi người khác. Tải lại để xem bản mới trước khi lưu."*

### Soft lock
- Khi editor mở form sửa, ghi `{ email, timestamp }` vào `metadata.dangChinhSua`.
- Người dùng khác thấy banner: *"⚠️ [email] đang chỉnh sửa"*.
- Lock tự động hết sau **10 phút** không hoạt động (kiểm tra bằng timestamp).

### Lỗi mạng / offline
- Dữ liệu cache trong `sessionStorage`; nếu offline, app vẫn xem được (read-only).
- Hiện banner: *"Đang offline — chỉ xem được, không lưu được"*.

### Lỗi quyền Drive
- Nếu không đọc được file (403/404) → hiện hướng dẫn liên hệ admin để được cấp quyền.

---

## 11. Cấu trúc thư mục dự án

```
giapha/
├── src/
│   ├── components/
│   │   ├── TreeView/          # Sơ đồ cây (relatives-tree + react-d3-tree)
│   │   ├── ListView/          # Danh sách phân tầng
│   │   ├── PersonDetail/      # Panel chi tiết người
│   │   ├── PersonForm/        # Modal thêm/sửa người
│   │   ├── PersonPicker/      # Modal phụ chọn người (bố/mẹ/vợ/chồng)
│   │   ├── SearchBar/         # Tìm kiếm theo tên
│   │   ├── Navbar/
│   │   └── PermissionManager/ # Quản lý quyền (admin only)
│   ├── services/
│   │   ├── googleAuth.ts      # OAuth2 PKCE
│   │   └── googleDrive.ts     # Đọc/ghi Drive API
│   ├── store/
│   │   └── useGiaphaStore.ts  # Zustand store
│   ├── types/
│   │   └── giapha.ts          # TypeScript types
│   └── utils/
│       ├── familyTree.ts      # Tính toán quan hệ, auto-fill logic
│       └── conflict.ts        # Conflict detection, soft lock
├── public/
├── docs/superpowers/specs/
└── .github/workflows/deploy.yml
```

---

## 12. Các tính năng ngoài phạm vi (không làm)

- Realtime sync giữa nhiều người dùng đồng thời
- Upload ảnh cho từng người
- Xuất PDF / in ấn
- Đa ngôn ngữ (chỉ tiếng Việt)
- Lịch sử thay đổi (version history)
