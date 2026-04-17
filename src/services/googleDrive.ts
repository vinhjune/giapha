import type { GiaphaData } from '../types/giapha'
import { layAccessToken } from './googleAuth'

const DRIVE_API = 'https://www.googleapis.com/drive/v3'
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3'
const FOLDER_NAME = 'giapha'
const FILE_NAME = 'giapha.json'

function headers(): HeadersInit {
  const token = layAccessToken()
  if (!token) throw new Error('Chưa đăng nhập')
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
}

/** Read the giapha.json file using its file ID */
export async function docFile(fileId: string): Promise<GiaphaData> {
  const res = await fetch(`${DRIVE_API}/files/${fileId}?alt=media`, {
    headers: headers(),
  })
  if (!res.ok) throw new Error(`Không đọc được file: ${res.status}`)
  return res.json()
}

/** Read file without auth (public mode via API key) */
export async function docFileCong(fileId: string, apiKey: string): Promise<GiaphaData> {
  const res = await fetch(`${DRIVE_API}/files/${fileId}?alt=media&key=${apiKey}`)
  if (!res.ok) throw new Error(`Không đọc được file công khai: ${res.status}`)
  return res.json()
}

/** Write (update) existing file */
export async function ghiFile(fileId: string, data: GiaphaData): Promise<void> {
  const body = JSON.stringify(data)
  const res = await fetch(`${UPLOAD_API}/files/${fileId}?uploadType=media`, {
    method: 'PATCH',
    headers: headers(),
    body,
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Lưu thất bại: ${err}`)
  }
}

/** Find or create the 'giapha' folder, then create giapha.json inside it. Returns file ID. */
export async function khoiTaoFile(nguoiTao: string = ''): Promise<string> {
  const token = layAccessToken()
  if (!token) throw new Error('Chưa đăng nhập')
  const authHeader = { Authorization: `Bearer ${token}` }

  // Find existing folder
  const folderSearch = await fetch(
    `${DRIVE_API}/files?q=name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id)`,
    { headers: authHeader }
  )
  if (!folderSearch.ok) throw new Error(`Không tìm được thư mục: ${folderSearch.status}`)
  const { files: folders } = await folderSearch.json()
  let folderId: string

  if (folders && folders.length > 0) {
    folderId = folders[0].id
  } else {
    // Create folder
    const createFolder = await fetch(`${DRIVE_API}/files`, {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' }),
    })
    if (!createFolder.ok) {
      const err = await createFolder.text()
      throw new Error(`Tạo thư mục thất bại: ${err}`)
    }
    const folder = await createFolder.json()
    folderId = folder.id
  }

  // Create giapha.json in the folder
  const meta = { name: FILE_NAME, parents: [folderId] }
  const initData: GiaphaData = {
    metadata: {
      tenDongHo: 'Gia Phả',
      ngayTao: new Date().toISOString(),
      nguoiTao,
      phienBan: 1,
      cheDoCong: false,
      danhSachNguoiDung: [],
    },
    persons: {},
  }
  const form = new FormData()
  form.append('metadata', new Blob([JSON.stringify(meta)], { type: 'application/json' }))
  form.append('file', new Blob([JSON.stringify(initData)], { type: 'application/json' }))

  const createRes = await fetch(`${UPLOAD_API}/files?uploadType=multipart&fields=id`, {
    method: 'POST',
    headers: authHeader,
    body: form,
  })
  if (!createRes.ok) {
    const err = await createRes.text()
    throw new Error(`Tạo file thất bại: ${err}`)
  }
  const { id } = await createRes.json()
  return id
}

/** Share file publicly (anyone with link can view) */
export async function chiaSeCong(fileId: string): Promise<void> {
  const res = await fetch(`${DRIVE_API}/files/${fileId}/permissions`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ role: 'reader', type: 'anyone' }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Chia sẻ thất bại: ${err}`)
  }
}

/** Remove public sharing */
export async function xoaChiaSeCong(fileId: string): Promise<void> {
  const token = layAccessToken()
  if (!token) throw new Error('Chưa đăng nhập')
  const authHeader = { Authorization: `Bearer ${token}` }

  // Get permission ID first
  const res = await fetch(
    `${DRIVE_API}/files/${fileId}/permissions?fields=permissions(id,type)`,
    { headers: authHeader }
  )
  if (!res.ok) throw new Error(`Không lấy được danh sách quyền: ${res.status}`)

  const { permissions } = await res.json()
  const anyonePerm = permissions?.find((p: any) => p.type === 'anyone')
  if (!anyonePerm) return

  const delRes = await fetch(
    `${DRIVE_API}/files/${fileId}/permissions/${anyonePerm.id}`,
    { method: 'DELETE', headers: authHeader }
  )
  if (!delRes.ok) throw new Error(`Xóa quyền chia sẻ thất bại: ${delRes.status}`)
}
