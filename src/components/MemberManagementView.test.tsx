import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MemberManagementView from './MemberManagementView'
import { useGiaphaStore } from '../store/useGiaphaStore'
import type { GiaphaData } from '../types/giapha'

vi.mock('../services/api', () => ({
  createPerson: vi.fn(),
  updatePerson: vi.fn(),
  deletePerson: vi.fn(),
  getTree: vi.fn(),
}))

import * as api from '../services/api'

const data: GiaphaData = {
  metadata: { tenDongHo: 'Dòng họ mẫu' },
  persons: {
    '1': { id: '1', hoTen: 'Ông Tổ', gioiTinh: 'nam', laThanhVienHo: true, thuTuDoi: 1, honNhan: [], conCaiIds: ['2'] },
    '2': { id: '2', hoTen: 'Con Trai', gioiTinh: 'nam', laThanhVienHo: true, boId: '1', thuTuDoi: 2, honNhan: [], conCaiIds: [] },
  },
}

describe('MemberManagementView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useGiaphaStore.setState({
      data,
      viewMode: 'members',
      selectedPersonId: null,
      focusedPersonId: null,
    })
  })

  it('shows all members in editable table with generation column', () => {
    render(<MemberManagementView />)

    expect(screen.getByText('Quản lý thành viên')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Ông Tổ')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Con Trai')).toBeInTheDocument()
    expect(screen.getByText('Đời')).toBeInTheDocument()
    expect(screen.getByTestId('thuTuDoi-0')).toHaveValue('1')
    expect(screen.getByTestId('thuTuDoi-1')).toHaveValue('2')
    expect(screen.getByText('Ngày sinh')).toBeInTheDocument()
    expect(screen.getByText('Ngày mất')).toBeInTheDocument()
    expect(screen.getByText('Địa chỉ')).toBeInTheDocument()
    expect(screen.getByText('Tiểu sử')).toBeInTheDocument()
    expect(screen.getByTestId('member-table-scroll')).toBeInTheDocument()
  })

  it('allows adding a new row and applying changes in one action', async () => {
    vi.mocked(api.createPerson).mockResolvedValue({ id: 'new-1' })
    vi.mocked(api.getTree).mockResolvedValue({
      metadata: data.metadata,
      persons: {
        ...data.persons,
        'new-1': { id: 'new-1', hoTen: 'Thành viên mới', gioiTinh: 'nam', laThanhVienHo: true, boId: '1', honNhan: [], conCaiIds: [] },
      },
    })

    const user = userEvent.setup()
    render(<MemberManagementView />)

    await user.click(screen.getByRole('button', { name: 'Thêm dòng mới' }))
    await user.type(screen.getByTestId('hoTen-2'), 'Thành viên mới')
    await user.click(screen.getByRole('button', { name: 'Chọn bố dòng 3' }))
    const modal = (await screen.findByText('Chọn bố')).closest('div.bg-white') as HTMLElement
    await user.click(within(modal).getByText('Ông Tổ'))

    await user.click(screen.getByRole('button', { name: 'Áp dụng thay đổi' }))

    expect(api.createPerson).toHaveBeenCalledWith(expect.objectContaining({ hoTen: 'Thành viên mới', boId: '1' }))
    expect(await screen.findByText(/Đã cập nhật/)).toBeInTheDocument()
  })

  it('allows toggling ngoại tộc and deleting a row', async () => {
    const user = userEvent.setup()
    render(<MemberManagementView />)

    const ngoaiTocCheckbox = screen.getByTestId('laThanhVienHo-1')
    expect(ngoaiTocCheckbox).not.toBeChecked()
    await user.click(ngoaiTocCheckbox)
    expect(ngoaiTocCheckbox).toBeChecked()

    const deleteButton = screen.getByRole('button', { name: 'Xóa thành viên dòng 2' })
    await user.click(deleteButton)
    expect(screen.queryByDisplayValue('Con Trai')).not.toBeInTheDocument()
    expect(api.deletePerson).not.toHaveBeenCalled()
  })

  it('rejects a non-numeric Đời value but still saves other valid rows in the same batch', async () => {
    const user = userEvent.setup()
    render(<MemberManagementView />)

    await user.type(screen.getByTestId('thuTuDoi-1'), 'x')
    await user.type(screen.getByTestId('tieuSu-0'), 'Cập nhật')
    await user.click(screen.getByRole('button', { name: 'Áp dụng thay đổi' }))

    expect(await screen.findByText(/Đời phải là số/)).toBeInTheDocument()
    expect(api.updatePerson).not.toHaveBeenCalledWith('2', expect.anything())
    expect(api.updatePerson).toHaveBeenCalledWith('1', expect.objectContaining({ tieuSu: 'Cập nhật' }))
  })

  it('rejects a decimal or non-finite Đời value', async () => {
    const user = userEvent.setup()
    render(<MemberManagementView />)

    await user.clear(screen.getByTestId('thuTuDoi-1'))
    await user.type(screen.getByTestId('thuTuDoi-1'), '1.5')
    await user.click(screen.getByRole('button', { name: 'Áp dụng thay đổi' }))

    expect(await screen.findByText(/Đời phải là số/)).toBeInTheDocument()
    expect(api.updatePerson).not.toHaveBeenCalledWith('2', expect.anything())
  })

  it('saves a partial lunar birth date entered via the masked date input', async () => {
    const user = userEvent.setup()
    render(<MemberManagementView />)

    const dateInput = screen.getByTestId('namSinh-0-date')
    await user.click(dateInput)
    await user.keyboard('{ArrowRight}{ArrowRight}')
    await user.type(dateInput, '1954')
    await user.click(screen.getByTestId('namSinh-0-amLich'))
    await user.click(screen.getByRole('button', { name: 'Áp dụng thay đổi' }))

    expect(await screen.findByText(/Đã cập nhật/)).toBeInTheDocument()
    expect(api.updatePerson).toHaveBeenCalledWith('1', expect.objectContaining({
      namSinh: { nam: 1954, thang: undefined, ngay: undefined, amLich: true },
    }))
  })
})
