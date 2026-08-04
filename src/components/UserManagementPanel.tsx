import { useEffect, useState } from 'react'
import * as api from '../services/api'
import type { ManagedUser, UserRole } from '../types/giapha'

export default function UserManagementPanel() {
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<UserRole>('editor')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editUsername, setEditUsername] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editPassword, setEditPassword] = useState('')

  async function refresh() {
    setLoading(true)
    try {
      const { users } = await api.listUsers()
      setUsers(users)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { refresh() }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await api.createUser({ username, password, role, email })
      setFormOpen(false)
      setUsername(''); setEmail(''); setPassword(''); setRole('editor')
      await refresh()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function handleDelete(id: string) {
    setError(null)
    try {
      await api.deleteUser(id)
      await refresh()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function handleRoleChange(id: string, newRole: UserRole) {
    setError(null)
    try {
      await api.updateUser(id, { role: newRole })
      await refresh()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  function startEdit(u: ManagedUser) {
    setError(null)
    setEditingId(u.id)
    setEditUsername(u.username)
    setEditEmail(u.email)
    setEditPassword('')
  }

  function cancelEdit() {
    setEditingId(null)
    setEditUsername(''); setEditEmail(''); setEditPassword('')
  }

  async function handleSaveEdit(e: React.FormEvent, id: string) {
    e.preventDefault()
    setError(null)
    try {
      const update: Partial<{ username: string; email: string; password: string }> = {
        username: editUsername.trim(),
        email: editEmail.trim(),
      }
      // Blank password field means "leave unchanged" — never sent, so the
      // stored hash is never overwritten with an empty/plaintext value.
      if (editPassword) update.password = editPassword
      await api.updateUser(id, update)
      cancelEdit()
      await refresh()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-gray-800">Quản lý người dùng</h2>
        <button
          onClick={() => setFormOpen(v => !v)}
          className="px-3 py-1.5 text-sm rounded-md border border-gray-300 hover:bg-gray-50"
        >
          Thêm người dùng
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {formOpen && (
        <form onSubmit={handleCreate} className="border border-gray-200 rounded-lg p-3 mb-4 flex flex-col gap-3 max-w-sm">
          <div>
            <label htmlFor="new-user-username" className="block text-sm text-gray-600 mb-1">Tên đăng nhập</label>
            <input id="new-user-username" value={username} onChange={e => setUsername(e.target.value)} required className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md" />
          </div>
          <div>
            <label htmlFor="new-user-email" className="block text-sm text-gray-600 mb-1">Email</label>
            <input id="new-user-email" type="email" value={email} onChange={e => setEmail(e.target.value)} required className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md" />
          </div>
          <div>
            <label htmlFor="new-user-password" className="block text-sm text-gray-600 mb-1">Mật khẩu</label>
            <input id="new-user-password" type="password" value={password} onChange={e => setPassword(e.target.value)} required className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md" />
          </div>
          <div>
            <label htmlFor="new-user-role" className="block text-sm text-gray-600 mb-1">Vai trò</label>
            <select id="new-user-role" value={role} onChange={e => setRole(e.target.value as UserRole)} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md">
              <option value="editor">Editor</option>
              <option value="admin">Admin</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setFormOpen(false)} className="px-4 py-2 text-sm rounded-md border border-gray-300 hover:bg-gray-50">Hủy</button>
            <button type="submit" className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700">Tạo</button>
          </div>
        </form>
      )}

      {loading && <p className="text-sm text-gray-400">Đang tải…</p>}

      <ul className="space-y-2">
        {users.map(u => (
          <li key={u.id} className="border border-gray-200 rounded-lg p-3">
            {editingId === u.id ? (
              <form onSubmit={e => handleSaveEdit(e, u.id)} className="flex flex-col gap-3 max-w-sm">
                <div>
                  <label htmlFor={`edit-username-${u.id}`} className="block text-sm text-gray-600 mb-1">Tên đăng nhập</label>
                  <input
                    id={`edit-username-${u.id}`}
                    value={editUsername}
                    onChange={e => setEditUsername(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label htmlFor={`edit-email-${u.id}`} className="block text-sm text-gray-600 mb-1">Email</label>
                  <input
                    id={`edit-email-${u.id}`}
                    type="email"
                    value={editEmail}
                    onChange={e => setEditEmail(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label htmlFor={`edit-password-${u.id}`} className="block text-sm text-gray-600 mb-1">Mật khẩu mới (để trống nếu không đổi)</label>
                  <input
                    id={`edit-password-${u.id}`}
                    type="password"
                    value={editPassword}
                    onChange={e => setEditPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={cancelEdit} className="px-4 py-2 text-sm rounded-md border border-gray-300 hover:bg-gray-50">Hủy</button>
                  <button type="submit" className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700">Lưu</button>
                </div>
              </form>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-gray-800">{u.username}</p>
                  <p className="text-xs text-gray-500">{u.email}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <select
                    aria-label={`Vai trò của ${u.username}`}
                    value={u.role}
                    onChange={e => handleRoleChange(u.id, e.target.value as UserRole)}
                    className="px-2 py-1 text-sm border border-gray-300 rounded-md"
                  >
                    <option value="editor">Editor</option>
                    <option value="admin">Admin</option>
                    <option value="viewer">Viewer</option>
                  </select>
                  <button
                    onClick={() => startEdit(u)}
                    className="px-3 py-1.5 text-sm rounded-md border border-gray-300 hover:bg-gray-50"
                  >
                    Sửa
                  </button>
                  <button
                    onClick={() => handleDelete(u.id)}
                    className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-md hover:bg-red-700"
                  >
                    Xóa
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

