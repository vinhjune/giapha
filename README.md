# Gia Phả

Ứng dụng quản lý gia phả trực tuyến, lưu dữ liệu trên Google Drive, chạy hoàn toàn trên trình duyệt (không cần backend).

**Công nghệ:** React 19 · TypeScript · Vite · Tailwind CSS · Zustand · Google Drive API v3

---

## Chạy thử trên local

### Yêu cầu

- Node.js ≥ 18
- npm ≥ 9
- Tài khoản Google (để dùng tính năng Drive; không bắt buộc nếu chỉ xem demo)

### 1. Cài đặt phụ thuộc

```bash
npm install
```

### 2. Tạo file biến môi trường

Tạo file `.env.local` ở thư mục gốc:

```env
VITE_GOOGLE_CLIENT_ID=<Google OAuth 2.0 Client ID của bạn>
VITE_GIAPHA_FILE_ID=<ID file giapha.json trên Google Drive>
VITE_GOOGLE_API_KEY=<Google API Key (tuỳ chọn — cần để xem công khai không đăng nhập)>
VITE_ZALO_APP_ID=<Zalo App ID (tuỳ chọn — cần để bật đăng nhập bằng Zalo)>
```

> **Lấy `VITE_GOOGLE_CLIENT_ID`:** Vào [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials → tạo OAuth 2.0 Client ID (loại *Web application*), thêm `http://localhost:5173` vào *Authorized JavaScript origins*.

> **`VITE_GIAPHA_FILE_ID`:** Là phần ID trong URL khi mở file trên Drive, ví dụ `https://drive.google.com/file/d/<FILE_ID>/view`. Nếu chưa có file, bỏ trống — ứng dụng sẽ hiển thị màn hình Admin Setup để tạo file mới lần đầu.

> **Bỏ qua biến môi trường (chế độ demo):** Nếu không điền `VITE_GOOGLE_CLIENT_ID`, ứng dụng tự chuyển sang chế độ demo với dữ liệu mẫu có sẵn — không cần đăng nhập.

### 3. Khởi động server phát triển

```bash
npm run dev
```

Mở trình duyệt tại `http://localhost:5173`.

### 4. Các lệnh khác

| Lệnh | Mô tả |
|---|---|
| `npm run dev` | Khởi động dev server (HMR) |
| `npm run build` | Build production vào thư mục `dist/` |
| `npm run preview` | Xem trước bản build production |
| `npm test` | Chạy test ở chế độ watch |
| `npm run test:run` | Chạy test một lần rồi thoát |
| `npm run lint` | Kiểm tra lỗi ESLint |

---

## Đăng nhập bằng Zalo

Để cho phép người dùng đăng nhập bằng tài khoản Zalo, quản trị viên cần thực hiện các bước sau:

### 1. Tạo Zalo App

1. Truy cập [Zalo Developers](https://developers.zalo.me/) và đăng nhập bằng tài khoản Zalo.
2. Vào **My Apps** → **Create App**, điền tên ứng dụng và chọn loại *Website*.
3. Sau khi tạo xong, ghi lại **App ID** (hiển thị trong trang cài đặt app).

### 2. Cấu hình OAuth Redirect URI

Trong trang cài đặt Zalo App:

1. Vào tab **Đăng nhập với Zalo**.
2. Bật tính năng **Đăng nhập với Zalo**.
3. Thêm các URL cho phép vào mục **Redirect URI**:
   - Development: `http://localhost:5173`
   - Production: URL thực tế của ứng dụng, ví dụ `https://giapha.example.com`
4. Lưu thay đổi.

### 3. Thêm biến môi trường

Thêm `VITE_ZALO_APP_ID` vào file `.env.local`:

```env
VITE_ZALO_APP_ID=<App ID của Zalo App>
```

Khi triển khai production, thêm biến này vào cấu hình hosting (Vercel, Netlify, v.v.).

### 4. Thêm người dùng Zalo vào danh sách quyền truy cập

Người dùng đăng nhập bằng Zalo được định danh bằng email dạng `zalo:<ZaloUserID>` trong hệ thống. Để cấp quyền cho người dùng Zalo:

1. Đăng nhập bằng tài khoản **admin** (Google).
2. Vào **Quản lý quyền truy cập** trong menu.
3. Thêm người dùng với email `zalo:<ID>` và chọn vai trò phù hợp.

> **Lưu ý:** Đăng nhập bằng Zalo sử dụng PKCE (Proof Key for Code Exchange) — không cần backend và không lưu `App Secret` ở phía client. Dữ liệu gia phả vẫn được lưu trên Google Drive; người dùng Zalo truy cập thông qua chế độ công khai (cần `VITE_GOOGLE_API_KEY`).

---

## Nhập dữ liệu từ CSV

Đăng nhập với quyền **admin**, bấm nút **Nhập CSV** trên thanh điều hướng. File CSV cần theo định dạng chuẩn — xem file mẫu tại [`docs/giapha-sample.csv`](docs/giapha-sample.csv).
Khi lưu file CSV, hãy dùng encoding **UTF-8** để bảo toàn tiếng Việt có dấu.

## Quản lý thành viên

Trên thanh điều hướng, chọn tab **Thành viên** để mở màn hình bảng quản lý thành viên. Màn hình này hiển thị đầy đủ các cột theo chuẩn CSV (kèm cột **Đời**), cho phép sửa trực tiếp nhiều dòng, thêm dòng mới và bấm **Áp dụng thay đổi** để cập nhật dữ liệu hàng loạt.

---

## Cấu trúc dữ liệu

Dữ liệu lưu dưới dạng file `giapha.json` trên Google Drive của người dùng. Xem đặc tả đầy đủ tại [`docs/superpowers/specs/2026-04-16-giapha-design.md`](docs/superpowers/specs/2026-04-16-giapha-design.md).


```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
