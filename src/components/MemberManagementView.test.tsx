import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
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
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('Năm sinh')).toBeInTheDocument()
    expect(screen.getByText('Năm mất')).toBeInTheDocument()
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
    await user.type(screen.getByTestId('boId-2'), '1')

    await user.click(screen.getByRole('button', { name: 'Áp dụng thay đổi' }))

    expect(api.createPerson).toHaveBeenCalledWith(expect.objectContaining({ hoTen: 'Thành viên mới', boId: '1' }))
    expect(await screen.findByText(/Đã cập nhật/)).toBeInTheDocument()
  })

  it('allows checkbox toggle and deleting a row', async () => {
    const user = userEvent.setup()
    render(<MemberManagementView />)

    const memberCheckbox = screen.getByTestId('laThanhVienHo-1')
    expect(memberCheckbox).toBeChecked()
    await user.click(memberCheckbox)
    expect(memberCheckbox).not.toBeChecked()

    const deleteButton = screen.getByRole('button', { name: 'Xóa thành viên dòng 2' })
    await user.click(deleteButton)
    expect(screen.queryByDisplayValue('Con Trai')).not.toBeInTheDocument()
    expect(api.deletePerson).not.toHaveBeenCalled()
  })
})
