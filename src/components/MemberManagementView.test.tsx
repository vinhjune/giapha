import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MemberManagementView from './MemberManagementView'
import { useGiaphaStore } from '../store/useGiaphaStore'
import type { GiaphaData } from '../types/giapha'

const data: GiaphaData = {
  metadata: {
    tenDongHo: 'Dòng họ mẫu',
    ngayTao: '2026-01-01T00:00:00.000Z',
    nguoiTao: 'admin@example.com',
    phienBan: 1,
    cheDoCong: true,
    danhSachNguoiDung: [],
  },
  persons: {
    1: {
      id: 1,
      hoTen: 'Ông Tổ',
      gioiTinh: 'nam',
      laThanhVienHo: true,
      honNhan: [],
      conCaiIds: [2],
    },
    2: {
      id: 2,
      hoTen: 'Con Trai',
      gioiTinh: 'nam',
      laThanhVienHo: true,
      boId: 1,
      honNhan: [],
      conCaiIds: [],
    },
  },
}

describe('MemberManagementView', () => {
  beforeEach(() => {
    useGiaphaStore.setState({
      data,
      fileId: 'file-id',
      currentUserEmail: 'admin@example.com',
      currentRole: 'admin',
      viewMode: 'members',
      selectedPersonId: null,
      focusedPersonId: null,
      isDirty: false,
      isSaving: false,
      conflictDetected: false,
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
    expect(screen.queryByText('Ảnh đại diện')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Độ rộng cột ID')).toBeInTheDocument()
  })

  it('allows adding a new row and applying changes in one action', async () => {
    const user = userEvent.setup()
    render(<MemberManagementView />)

    await user.click(screen.getByRole('button', { name: 'Thêm dòng mới' }))
    await user.type(screen.getByTestId('hoTen-2'), 'Thành viên mới')
    await user.type(screen.getByTestId('boId-2'), '1')

    await user.click(screen.getByRole('button', { name: 'Áp dụng thay đổi' }))

    const state = useGiaphaStore.getState().data
    expect(state).toBeTruthy()
    const newPerson = Object.values(state!.persons).find(person => person.hoTen === 'Thành viên mới')
    expect(newPerson).toBeTruthy()
    expect(newPerson?.boId).toBe(1)
    expect(newPerson?.id).toBeGreaterThan(2)
    expect(state!.persons[1].conCaiIds).toContain(newPerson!.id)
    expect(screen.getByText(/Đã cập nhật/)).toBeInTheDocument()
  })

  it('allows checkbox toggle and deleting a row', async () => {
    const user = userEvent.setup()
    render(<MemberManagementView />)

    const memberCheckbox = screen.getByTestId('laThanhVienHo-1')
    expect(memberCheckbox).toBeChecked()
    await user.click(memberCheckbox)
    expect(memberCheckbox).not.toBeChecked()

    await user.click(screen.getByRole('button', { name: 'Xóa thành viên dòng 2' }))
    expect(screen.queryByDisplayValue('Con Trai')).not.toBeInTheDocument()
  })
})
