import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SearchBar from './SearchBar'
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
    1: { id: 1, hoTen: 'Nguyễn Văn An', gioiTinh: 'nam', laThanhVienHo: true, honNhan: [], conCaiIds: [] },
    2: { id: 2, hoTen: 'Nguyễn Văn Anh', gioiTinh: 'nam', laThanhVienHo: true, honNhan: [], conCaiIds: [] },
    3: { id: 3, hoTen: 'Nguyễn Văn Bình', gioiTinh: 'nam', laThanhVienHo: true, honNhan: [], conCaiIds: [] },
  },
}

describe('SearchBar focus behavior', () => {
  beforeEach(() => {
    useGiaphaStore.setState({
      data,
      fileId: null,
      currentUserEmail: null,
      currentRole: 'public',
      viewMode: 'tree',
      selectedPersonId: 1,
      focusedPersonId: 1,
      isDirty: false,
      isSaving: false,
      conflictDetected: false,
    })
  })

  it('focuses single found member without changing selected detail member', async () => {
    const user = userEvent.setup()
    render(<SearchBar />)

    await user.type(screen.getByPlaceholderText('Tìm kiếm theo tên...'), 'Bình')

    const { selectedPersonId, focusedPersonId } = useGiaphaStore.getState()
    expect(selectedPersonId).toBe(1)
    expect(focusedPersonId).toBe(3)
  })

  it('focuses chosen member from search results without opening its detail', async () => {
    const user = userEvent.setup()
    render(<SearchBar />)

    await user.type(screen.getByPlaceholderText('Tìm kiếm theo tên...'), 'An')
    await user.click(screen.getByText('Nguyễn Văn Anh'))

    const { selectedPersonId, focusedPersonId } = useGiaphaStore.getState()
    expect(selectedPersonId).toBe(1)
    expect(focusedPersonId).toBe(2)
  })
})
