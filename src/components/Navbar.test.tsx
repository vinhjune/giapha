import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Navbar from './Navbar'
import { useGiaphaStore } from '../store/useGiaphaStore'
import type { GiaphaData } from '../types/giapha'

const data: GiaphaData = {
  metadata: {
    tenDongHo: 'Dòng họ mẫu',
    ngayTao: '2026-01-01T00:00:00.000Z',
    nguoiTao: 'admin@example.com',
    phienBan: 1,
    cheDoCong: false,
    hienThiThuTuDoi: false,
    danhSachNguoiDung: [{ email: 'admin@example.com', role: 'admin' }],
  },
  persons: {
    1: { id: 1, hoTen: 'Người A', gioiTinh: 'nam', laThanhVienHo: true, honNhan: [], conCaiIds: [] },
  },
}

describe('Navbar hamburger menu actions', () => {
  beforeEach(() => {
    useGiaphaStore.setState({
      data,
      fileId: 'file-id',
      currentUserEmail: 'admin@example.com',
      currentRole: 'admin',
      viewMode: 'tree',
      selectedPersonId: 1,
      focusedPersonId: 1,
      isDirty: false,
      isSaving: false,
      conflictDetected: false,
    })
    vi.stubGlobal('alert', vi.fn())
  })

  it('shows hamburger button and menu entries while keeping search bar', async () => {
    const user = userEvent.setup()
    render(<Navbar />)

    expect(screen.getByRole('button', { name: 'Mở menu' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Quản lý thành viên' })).toBeNull()
    expect(screen.getByPlaceholderText('Tìm kiếm theo tên...')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Mở menu' }))

    expect(screen.getByLabelText('Chế độ xem')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Quản lý thành viên' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Quản lý quyền truy cập' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Nhập CSV' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Xuất CSV' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Chế độ công khai: Tắt' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Thứ tự đời: Tắt' })).toBeInTheDocument()
  })

  it('switches view modes from hamburger entries', async () => {
    const user = userEvent.setup()
    render(<Navbar />)

    await user.click(screen.getByRole('button', { name: 'Mở menu' }))
    await user.selectOptions(screen.getByLabelText('Chế độ xem'), 'list')
    expect(useGiaphaStore.getState().viewMode).toBe('list')

    await user.click(screen.getByRole('button', { name: 'Quản lý thành viên' }))
    expect(useGiaphaStore.getState().viewMode).toBe('members')
    expect(screen.queryByRole('button', { name: 'Quản lý quyền truy cập' })).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Mở menu' }))
    await user.click(screen.getByRole('button', { name: 'Quản lý quyền truy cập' }))
    expect(useGiaphaStore.getState().viewMode).toBe('permissions')
    expect(screen.queryByRole('button', { name: 'Quản lý thành viên' })).toBeNull()
  })
})
