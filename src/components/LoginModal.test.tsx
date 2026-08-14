import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import LoginModal from './LoginModal'
import { useAuthStore } from '../store/useAuthStore'

beforeEach(() => {
  useAuthStore.setState({ user: null, setupNeeded: false, loading: false, error: null, forgotPasswordMessage: null })
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

  it('switches to the forgot-password form and calls forgotPassword with the entered email', async () => {
    const forgotPasswordSpy = vi.spyOn(useAuthStore.getState(), 'forgotPassword').mockImplementation(async () => {
      useAuthStore.setState({ forgotPasswordMessage: 'Nếu email tồn tại trong hệ thống, mật khẩu mới đã được gửi tới email đó.' })
    })
    render(<LoginModal onClose={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Quên mật khẩu?' }))
    expect(screen.getByText('Quên mật khẩu')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Email đã đăng ký'), { target: { value: 'user@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Gửi mật khẩu mới' }))

    await waitFor(() => expect(forgotPasswordSpy).toHaveBeenCalledWith('user@example.com'))
    await waitFor(() => expect(screen.getByText(/mật khẩu mới đã được gửi/)).toBeInTheDocument())
  })

  it('lets the user go back to the login form from the forgot-password form', () => {
    render(<LoginModal onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Quên mật khẩu?' }))
    fireEvent.click(screen.getByRole('button', { name: /Quay lại đăng nhập/ }))
    expect(screen.getByRole('heading', { name: 'Đăng nhập' })).toBeInTheDocument()
  })
})
