import { useState } from 'react'
import { useGiaphaStore } from '../store/useGiaphaStore'
import type { Role, NguoiDung } from '../types/giapha'

export default function PermissionManager() {
  const { data, currentRole } = useGiaphaStore()
  const [newEmail, setNewEmail] = useState('')
  const [newRole, setNewRole] = useState<Role>('viewer')

  if (currentRole !== 'admin' || !data) return null

  const users = data.metadata.danhSachNguoiDung

  function addUser() {
    if (!newEmail.trim() || !data) return
    const updated: NguoiDung[] = [...users.filter(u => u.email !== newEmail.trim()), { email: newEmail.trim(), role: newRole }]
    useGiaphaStore.setState(state => ({
      data: state.data ? {
        ...state.data,
        metadata: { ...state.data.metadata, danhSachNguoiDung: updated },
      } : null,
      isDirty: true,
    }))
    setNewEmail('')
  }

  function removeUser(email: string) {
    if (!data) return
    const updated = users.filter(u => u.email !== email)
    useGiaphaStore.setState(state => ({
      data: state.data ? {
        ...state.data,
        metadata: { ...state.data.metadata, danhSachNguoiDung: updated },
      } : null,
      isDirty: true,
    }))
  }

  return (
    <div className="p-4 max-w-lg">
      <h3 className="font-semibold text-gray-800 mb-3">Quản lý quyền truy cập</h3>
      <div className="space-y-2 mb-4">
        {users.map(u => (
          <div key={u.email} className="flex items-center gap-3 text-sm">
            <span className="flex-1 text-gray-700">{u.email}</span>
            <span className={`px-2 py-0.5 rounded text-xs font-medium
              ${u.role === 'admin' ? 'bg-red-100 text-red-700' :
                u.role === 'editor' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
              {u.role}
            </span>
            {u.role !== 'admin' && (
              <button onClick={() => removeUser(u.email)} className="text-gray-400 hover:text-red-500">&times;</button>
            )}
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="Email"
          className="flex-1 px-3 py-1.5 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-400" />
        <select value={newRole} onChange={e => setNewRole(e.target.value as Role)}
          className="px-2 py-1.5 text-sm border rounded">
          <option value="viewer">Viewer</option>
          <option value="editor">Editor</option>
        </select>
        <button onClick={addUser} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">Thêm</button>
      </div>
    </div>
  )
}
