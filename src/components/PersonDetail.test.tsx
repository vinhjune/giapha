import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
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
    1: {
      id: 1,
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
      selectedPersonId: 1,
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

describe('PersonDetail contact info', () => {
  beforeEach(() => {
    useGiaphaStore.setState({
      data: {
        metadata: {
          tenDongHo: 'Dòng họ mẫu',
          ngayTao: '2026-01-01T00:00:00.000Z',
          nguoiTao: 'admin@example.com',
          phienBan: 1,
          cheDoCong: false,
          danhSachNguoiDung: [],
        },
        persons: {
          1: {
            id: 1,
            hoTen: 'Người Có Liên Hệ',
            gioiTinh: 'nam',
            email: 'p1@example.com',
            soDienThoai: '0909999999',
            laThanhVienHo: true,
            honNhan: [],
            conCaiIds: [],
          },
        },
      },
      selectedPersonId: 1,
      currentRole: 'viewer',
      fileId: null,
      currentUserEmail: null,
      viewMode: 'tree',
      isDirty: false,
      isSaving: false,
      conflictDetected: false,
    })
  })

  it('shows email and phone when provided', () => {
    render(<PersonDetail onEdit={vi.fn()} />)

    expect(screen.getByText('Email:')).toBeInTheDocument()
    expect(screen.getByText('p1@example.com')).toBeInTheDocument()
    expect(screen.getByText('Điện thoại:')).toBeInTheDocument()
    expect(screen.getByText('0909999999')).toBeInTheDocument()
  })

  it('renders correctly when selection changes from null to a person', () => {
    useGiaphaStore.setState({ selectedPersonId: null })
    render(<PersonDetail onEdit={vi.fn()} />)
    expect(screen.queryByText('Người Có Liên Hệ')).toBeNull()

    act(() => {
      useGiaphaStore.setState({ selectedPersonId: 1 })
    })

    expect(screen.getByText('Người Có Liên Hệ')).toBeInTheDocument()
  })
})
