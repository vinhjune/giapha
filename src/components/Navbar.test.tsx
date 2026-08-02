import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Navbar from './Navbar'
import { useAuthStore } from '../store/useAuthStore'
import { useGiaphaStore } from '../store/useGiaphaStore'
import { mockMatchMedia } from '../test-setup'

vi.mock('../services/api', () => ({
  exportCsv: vi.fn(),
  importCsv: vi.fn(),
  getAuthMe: vi.fn(),
  login: vi.fn(),
  setupFirstAdmin: vi.fn(),
  logout: vi.fn(),
}))

beforeEach(() => {
  useAuthStore.setState({ user: null, setupNeeded: false, loading: false, error: null })
  useGiaphaStore.setState({ data: { metadata: { tenDongHo: 'Họ Test' }, persons: {} }, viewMode: 'list', hienThiThuTuDoi: false })
})

function renderNavbar() {
  render(<MemoryRouter><Navbar /></MemoryRouter>)
}

describe('Navbar (anonymous)', () => {
  it('shows "Đăng nhập" and hides member/CSV actions in the dropdown', () => {
    renderNavbar()
    fireEvent.click(screen.getByLabelText('Mở menu'))
    expect(screen.getByText('Đăng nhập')).toBeInTheDocument()
    expect(screen.queryByText('Quản lý thành viên')).not.toBeInTheDocument()
    expect(screen.queryByText('Nhập CSV')).not.toBeInTheDocument()
    expect(screen.queryByText('Xuất CSV')).not.toBeInTheDocument()
    expect(screen.queryByText('Control Panel')).not.toBeInTheDocument()
  })

  it('opens the LoginModal when "Đăng nhập" is clicked', () => {
    renderNavbar()
    fireEvent.click(screen.getByLabelText('Mở menu'))
    fireEvent.click(screen.getByText('Đăng nhập'))
    expect(screen.getByLabelText('Tên đăng nhập')).toBeInTheDocument()
  })

  it('toggles generation order display from the menu', async () => {
    const user = userEvent.setup()
    renderNavbar()
    await user.click(screen.getByLabelText('Mở menu'))
    await user.click(screen.getByRole('button', { name: 'Thứ tự đời: Tắt' }))
    expect(useGiaphaStore.getState().hienThiThuTuDoi).toBe(true)
  })

  it('switches view modes from the dropdown select', async () => {
    const user = userEvent.setup()
    renderNavbar()
    await user.click(screen.getByLabelText('Mở menu'))
    await user.selectOptions(screen.getByLabelText('Chế độ xem'), 'tree')
    expect(useGiaphaStore.getState().viewMode).toBe('tree')
  })
})

describe('Navbar (logged in)', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: { id: '1', username: 'admin1', email: 'a@example.com', role: 'admin', personId: null } })
  })

  it('shows username, role badge, and Control Panel + Đăng xuất in the dropdown', () => {
    renderNavbar()
    expect(screen.getByText('admin1')).toBeInTheDocument()
    expect(screen.getByText('Admin')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Mở menu'))
    expect(screen.getByText('Control Panel')).toBeInTheDocument()
    expect(screen.getByText('Đăng xuất')).toBeInTheDocument()
    expect(screen.queryByText('Đăng nhập')).not.toBeInTheDocument()
  })
})

describe('Navbar mobile layout', () => {
  beforeEach(() => {
    mockMatchMedia(true)
  })

  it('moves the search bar to its own full-width row below the title bar', () => {
    renderNavbar()
    expect(screen.getByLabelText('Mở menu')).toBeInTheDocument()
    const searchRow = screen.getByTestId('navbar-search-row-mobile')
    expect(searchRow).toContainElement(screen.getByPlaceholderText('Tìm kiếm theo tên...'))
  })
})
