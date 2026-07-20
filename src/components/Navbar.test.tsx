import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Navbar from './Navbar'
import { useGiaphaStore } from '../store/useGiaphaStore'
import type { GiaphaData } from '../types/giapha'
import { mockMatchMedia } from '../test-setup'

vi.mock('../services/api', () => ({
  exportCsv: vi.fn(),
  importCsv: vi.fn(),
}))

const data: GiaphaData = {
  metadata: { tenDongHo: 'Dòng họ mẫu', hienThiThuTuDoi: false },
  persons: {
    '1': { id: '1', hoTen: 'Người A', gioiTinh: 'nam', laThanhVienHo: true, honNhan: [], conCaiIds: [] },
  },
}

describe('Navbar hamburger menu actions', () => {
  beforeEach(() => {
    useGiaphaStore.setState({
      data,
      viewMode: 'tree',
      selectedPersonId: '1',
      focusedPersonId: '1',
      hienThiThuTuDoi: false,
    })
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
    expect(screen.getByRole('button', { name: 'Nhập CSV' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Xuất CSV' })).toBeInTheDocument()
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
  })

  it('toggles generation order display from the menu', async () => {
    const user = userEvent.setup()
    render(<Navbar />)

    await user.click(screen.getByRole('button', { name: 'Mở menu' }))
    await user.click(screen.getByRole('button', { name: 'Thứ tự đời: Tắt' }))

    expect(useGiaphaStore.getState().hienThiThuTuDoi).toBe(true)
  })
})

describe('Navbar mobile layout', () => {
  beforeEach(() => {
    mockMatchMedia(true)
    useGiaphaStore.setState({
      data,
      viewMode: 'tree',
      selectedPersonId: '1',
      focusedPersonId: '1',
      hienThiThuTuDoi: false,
    })
  })

  it('moves the search bar to its own full-width row below the title bar', () => {
    render(<Navbar />)

    expect(screen.getByRole('button', { name: 'Mở menu' })).toBeInTheDocument()
    const searchRow = screen.getByTestId('navbar-search-row-mobile')
    expect(searchRow).toContainElement(screen.getByPlaceholderText('Tìm kiếm theo tên...'))
  })
})
