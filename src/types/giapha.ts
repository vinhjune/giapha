export type Role = 'admin' | 'editor' | 'viewer'

export type GioiTinh = 'nam' | 'nu' | 'khac'

export interface NgayThang {
  nam?: number      // year
  thang?: number    // month
  ngay?: number     // day
  amLich?: boolean  // true = lunar calendar
}

export interface HonNhan {
  voChongId: string
  batDau?: NgayThang
  ketThuc?: NgayThang
  ghiChu?: string
}

export interface Person {
  id: string
  hoTen: string                // Full name
  gioiTinh: GioiTinh
  email?: string
  soDienThoai?: string
  namSinh?: NgayThang
  namMat?: NgayThang
  queQuan?: string             // Hometown
  tieuSu?: string              // Biography
  anhDaiDien?: string          // Avatar URL or base64
  laThanhVienHo: boolean       // true = belongs to this clan; false = married in or left the lineage
  thuTuAnhChi?: number         // Sibling order (1-based)
  boId?: string                // Father ID
  meId?: string                // Mother ID
  honNhan: HonNhan[]           // Marriages (ordered)
  conCaiIds: string[]          // Children IDs — MUST be kept in sync across both parents; see familyTree.ts
  ghiChu?: string
}

export interface NguoiDung {
  email: string
  role: Role
}

export interface SoftLock {
  email: string
  hoTen: string
  thoiGian: string             // ISO timestamp
}

export interface Metadata {
  tenDongHo: string            // Clan name
  moTa?: string
  ngayTao: string              // ISO
  nguoiTao: string             // email of admin
  phienBan: number             // increments on each save (conflict detection)
  cheDoCong: boolean           // true = public read
  danhSachNguoiDung: NguoiDung[]
  dangChinhSua?: SoftLock      // soft lock
}

export interface GiaphaData {
  metadata: Metadata
  persons: Record<string, Person>  // id → Person map
}
