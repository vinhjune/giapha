import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import LoginModal from './LoginModal'
import { useAuthStore } from '../store/useAuthStore'

beforeEach(() => {
  useAuthStore.setState({ user: null, setupNeeded: false, loading: false, error: null })
})

describe('LoginModal', () => {
  it('renders username/password fields and calls login on submit', async () => {
    const onClose = vi.fn()
    const loginSpy = vi.spyOn(useAuthStore.getState(), 'login').mockImplementation(async () => {
      useAuthStore.setState({ user: { id: '1', username: 'admin', email: 'a@example.com', role: 'admin', personId: null } })
    })
    render(<LoginModal onClose={onClose} />)

    fireEvent.change(screen.getByLabelText('Tên đăng nhập'), { target: { value: 'admin' } })
    fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'secret' } })
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }))

    await waitFor(() => expect(loginSpy).toHaveBeenCalledWith('admin', 'secret'))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it('shows the first-admin setup form when setupNeeded is true', () => {
    useAuthStore.setState({ setupNeeded: true })
    render(<LoginModal onClose={vi.fn()} />)
    expect(screen.getByText('Tạo tài khoản Admin đầu tiên')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
  })

  it('displays an error message from the store', () => {
    useAuthStore.setState({ error: 'Sai tên đăng nhập hoặc mật khẩu' })
    render(<LoginModal onClose={vi.fn()} />)
    expect(screen.getByText('Sai tên đăng nhập hoặc mật khẩu')).toBeInTheDocument()
  })
})
