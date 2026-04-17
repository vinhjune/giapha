import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import PersonDetail from './PersonDetail'
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
    p1: {
      id: 'p1',
      hoTen: 'Nguyễn Văn A',
      gioiTinh: 'nam',
      laThanhVienHo: true,
      honNhan: [],
      conCaiIds: [],
    },
  },
}

describe('PersonDetail permissions', () => {
  beforeEach(() => {
    useGiaphaStore.setState({
      data,
      fileId: 'file-id',
      currentUserEmail: null,
      currentRole: 'public',
      viewMode: 'tree',
      selectedPersonId: 'p1',
      isDirty: false,
      isSaving: false,
      conflictDetected: false,
    })
  })

  it('hides edit and delete buttons in public mode', () => {
    render(<PersonDetail onEdit={vi.fn()} />)

    expect(screen.queryByRole('button', { name: 'Sửa' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Xóa' })).toBeNull()
  })
})
