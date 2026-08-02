export type GioiTinh = 'nam' | 'nu' | 'khac'

export interface NgayThang {
  nam?: number      // year
  thang?: number    // month
  ngay?: number     // day
  amLich?: boolean  // true = lunar calendar
}

export interface HonNhan {
  voChongId: string
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
  anhDaiDien?: string          // Avatar URL
  laThanhVienHo: boolean       // true = belongs to this clan; false = married in or left the lineage
  thuTuAnhChi?: number         // Sibling order (1-based)
  thuTuDoi?: number            // Generation order, computed and owned by the shared database
  boId?: string                // Father ID
  meId?: string                // Mother ID
  honNhan: HonNhan[]           // Marriages (ordered)
  conCaiIds: string[]          // Children IDs — derived server-side, read-only
  ghiChu?: string
  pendingRequestId?: string    // set when an update/delete request is awaiting admin approval
}

export interface Metadata {
  tenDongHo: string            // Clan name
  moTa?: string
  hienThiThuTuDoi?: boolean    // true = show generation order after person name
}

export interface GiaphaData {
  metadata: Metadata
  persons: Record<string, Person>  // id → Person map
}

export type UserRole = 'admin' | 'editor' | 'viewer'

export interface AuthUser {
  id: string
  username: string
  email: string
  role: UserRole
  personId: string | null
}

export interface EditorRequest {
  id: string
  type: 'create' | 'update' | 'delete'
  personId: string | null
  payload: string | null
  submittedBy: string
  status: 'pending' | 'approved' | 'rejected'
  resolvedBy: string | null
  resolvedAt: string | null
  createdAt: string
}

export interface ManagedUser {
  id: string
  username: string
  email: string
  role: UserRole
  personId: string | null
  isActive: boolean
  createdAt: string
}

export interface MutationResult {
  id?: string
  pending?: boolean
  requestId?: string
}
