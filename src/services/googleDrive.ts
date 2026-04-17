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
  if (!res.ok) {
    let detail = `${res.status}`
    try {
      const body = await res.json()
      const msg = body?.error?.message || body?.error?.status
      if (msg) detail = `${res.status} – ${msg}`
    } catch { /* response was not JSON */ }
    throw new Error(`Không đọc được file công khai: ${detail}`)
  }
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

/** Find or create the 'giapha' folder, then create giapha.json inside it.
 *  If the file already exists, returns its ID without creating a new one.
 *  Returns { id, data } so the caller can populate the store. */
export async function khoiTaoFile(tenDongHo: string = 'Gia Phả', nguoiTao: string = ''): Promise<{ id: string; data: GiaphaData }> {
  const token = layAccessToken()
  if (!token) throw new Error('Chưa đăng nhập')
  const authHeader = { Authorization: `Bearer ${token}` }

  // Find or create folder
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
    const createFolder = await fetch(`${DRIVE_API}/files`, {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' }),
    })
    if (!createFolder.ok) throw new Error(`Tạo thư mục thất bại: ${(await createFolder.text())}`)
    folderId = (await createFolder.json()).id
  }

  // Check if giapha.json already exists in folder
  const fileSearch = await fetch(
    `${DRIVE_API}/files?q=name='${FILE_NAME}' and '${folderId}' in parents and trashed=false&fields=files(id)`,
    { headers: authHeader }
  )
  if (!fileSearch.ok) throw new Error(`Không tìm được file: ${fileSearch.status}`)
  const { files: existing } = await fileSearch.json()
  if (existing && existing.length > 0) {
    const id = existing[0].id
    const data = await docFile(id)
    return { id, data }
  }

  // Create new giapha.json
  const initData: GiaphaData = {
    metadata: {
      tenDongHo,
      ngayTao: new Date().toISOString(),
      nguoiTao,
      phienBan: 1,
      cheDoCong: false,
      danhSachNguoiDung: [{ email: nguoiTao, role: 'admin' }],
    },
    persons: {},
  }
  const meta = { name: FILE_NAME, parents: [folderId] }
  const form = new FormData()
  form.append('metadata', new Blob([JSON.stringify(meta)], { type: 'application/json' }))
  form.append('file', new Blob([JSON.stringify(initData)], { type: 'application/json' }))

  const createRes = await fetch(`${UPLOAD_API}/files?uploadType=multipart&fields=id`, {
    method: 'POST',
    headers: authHeader,
    body: form,
  })
  if (!createRes.ok) throw new Error(`Tạo file thất bại: ${(await createRes.text())}`)
  const { id } = await createRes.json()
  return { id, data: initData }
}

/** Share file publicly (anyone with link can view) */
export async function chiaSeCong(fileId: string): Promise<void> {
  const res = await fetch(`${DRIVE_API}/files/${fileId}/permissions`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ role: 'reader', type: 'anyone' }),
  })
  if (!res.ok) {
    let detail = `${res.status}`
    try { const b = await res.json(); detail = b?.error?.message || detail } catch { /* ignore */ }
    throw new Error(`Chia sẻ thất bại: ${detail}`)
  }
}

/** Remove public sharing */
export async function xoaChiaSeCong(fileId: string): Promise<void> {
  const token = layAccessToken()
  if (!token) throw new Error('Chưa đăng nhập')
  const authHeader = { Authorization: `Bearer ${token}` }

  // Check ownership first
  const metaRes = await fetch(`${DRIVE_API}/files/${fileId}?fields=ownedByMe,capabilities(canShare)`, { headers: authHeader })
  if (metaRes.ok) {
    const meta = await metaRes.json()
    if (!meta.ownedByMe && !meta.capabilities?.canShare) {
      throw new Error('Bạn không phải chủ sở hữu file này và không có quyền quản lý chia sẻ. Hãy dùng tài khoản Google đã tạo file.')
    }
  }

  // Get permission ID (no field filter so we always get the id)
  const res = await fetch(
    `${DRIVE_API}/files/${fileId}/permissions`,
    { headers: authHeader }
  )
  if (!res.ok) throw new Error(`Không lấy được danh sách quyền: ${res.status}`)

  const { permissions } = await res.json()
  const anyonePerm = permissions?.find((p: any) => p.type === 'anyone')
  if (!anyonePerm) return
  if (!anyonePerm.id) throw new Error('Không tìm được ID của quyền công khai')

  const delRes = await fetch(
    `${DRIVE_API}/files/${fileId}/permissions/${anyonePerm.id}`,
    { method: 'DELETE', headers: authHeader }
  )
  if (!delRes.ok) {
    let detail = `${delRes.status}`
    try { const b = await delRes.json(); detail = b?.error?.message || b?.error?.status || detail } catch { /* ignore */ }
    throw new Error(`Xóa quyền chia sẻ thất bại: ${detail} | permissionId="${anyonePerm.id}"`)
  }
}
