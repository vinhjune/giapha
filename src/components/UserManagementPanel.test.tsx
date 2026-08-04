import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import UserManagementPanel from './UserManagementPanel'
import * as api from '../services/api'

vi.mock('../services/api')

const sampleUsers = [
  { id: 'u1', username: 'admin1', email: 'a@example.com', role: 'admin' as const, personId: null, isActive: true, createdAt: '2024-01-01T00:00:00.000Z' },
  { id: 'u2', username: 'ed1', email: 'e@example.com', role: 'editor' as const, personId: null, isActive: true, createdAt: '2024-01-02T00:00:00.000Z' },
]

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(api.listUsers).mockResolvedValue({ users: sampleUsers })
})

describe('UserManagementPanel', () => {
  it('lists existing users', async () => {
    render(<UserManagementPanel />)
    await waitFor(() => expect(screen.getByText('admin1')).toBeInTheDocument())
    expect(screen.getByText('ed1')).toBeInTheDocument()
  })

  it('creates a new user', async () => {
    vi.mocked(api.createUser).mockResolvedValue({ user: { id: 'u3', username: 'ed2', email: 'e2@example.com', role: 'editor', personId: null, isActive: true, createdAt: '2024-01-03T00:00:00.000Z' } })
    render(<UserManagementPanel />)
    await waitFor(() => screen.getByText('admin1'))
    fireEvent.click(screen.getByText('Thêm người dùng'))
    fireEvent.change(screen.getByLabelText('Tên đăng nhập'), { target: { value: 'ed2' } })
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'e2@example.com' } })
    fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Tạo' }))
    await waitFor(() => expect(api.createUser).toHaveBeenCalledWith({
      username: 'ed2', password: 'password123', role: 'editor', email: 'e2@example.com',
    }))
  })

  it('deletes a user', async () => {
    vi.mocked(api.deleteUser).mockResolvedValue({ ok: true })
    render(<UserManagementPanel />)
    await waitFor(() => screen.getByText('ed1'))
    fireEvent.click(screen.getAllByText('Xóa')[1])
    await waitFor(() => expect(api.deleteUser).toHaveBeenCalledWith('u2'))
  })

  it('shows the backend error when deleting the last admin fails', async () => {
    vi.mocked(api.deleteUser).mockRejectedValue(new Error('Không thể xóa admin cuối cùng'))
    render(<UserManagementPanel />)
    await waitFor(() => screen.getByText('admin1'))
    fireEvent.click(screen.getAllByText('Xóa')[0])
    await waitFor(() => expect(screen.getByText('Không thể xóa admin cuối cùng')).toBeInTheDocument())
  })

  it('edits username and email for an existing user, masking the password field', async () => {
    vi.mocked(api.updateUser).mockResolvedValue({ user: { ...sampleUsers[1], username: 'ed1-renamed', email: 'renamed@example.com' } })
    render(<UserManagementPanel />)
    await waitFor(() => screen.getByText('ed1'))

    fireEvent.click(screen.getAllByText('Sửa')[1])
    const usernameInput = screen.getByLabelText('Tên đăng nhập') as HTMLInputElement
    const passwordInput = screen.getByLabelText('Mật khẩu mới (để trống nếu không đổi)') as HTMLInputElement
    expect(passwordInput.type).toBe('password')
    expect(passwordInput.value).toBe('')

    fireEvent.change(usernameInput, { target: { value: 'ed1-renamed' } })
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'renamed@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }))

    await waitFor(() => expect(api.updateUser).toHaveBeenCalledWith('u2', {
      username: 'ed1-renamed', email: 'renamed@example.com',
    }))
  })

  it('only sends a new password when the field is filled in', async () => {
    vi.mocked(api.updateUser).mockResolvedValue({ user: sampleUsers[1] })
    render(<UserManagementPanel />)
    await waitFor(() => screen.getByText('ed1'))

    fireEvent.click(screen.getAllByText('Sửa')[1])
    fireEvent.change(screen.getByLabelText('Mật khẩu mới (để trống nếu không đổi)'), { target: { value: 'newpass123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }))

    await waitFor(() => expect(api.updateUser).toHaveBeenCalledWith('u2', {
      username: 'ed1', email: 'e@example.com', password: 'newpass123',
    }))
  })

  it('shows the backend error when saving an edit with a duplicate email fails', async () => {
    vi.mocked(api.updateUser).mockRejectedValue(new Error('Email đã được sử dụng'))
    render(<UserManagementPanel />)
    await waitFor(() => screen.getByText('ed1'))

    fireEvent.click(screen.getAllByText('Sửa')[1])
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }))

    await waitFor(() => expect(screen.getByText('Email đã được sử dụng')).toBeInTheDocument())
  })
})
