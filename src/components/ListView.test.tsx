import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import ListView from './ListView'
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
      hoTen: 'Ông Nông',
      gioiTinh: 'nam',
      laThanhVienHo: true,
      honNhan: [{ voChongId: 2 }],
      conCaiIds: [3, 4],
    },
    2: {
      id: 2,
      hoTen: 'Bà Thanh',
      gioiTinh: 'nu',
      laThanhVienHo: false,
      honNhan: [{ voChongId: 1 }],
      conCaiIds: [3, 4],
    },
    3: {
      id: 3,
      hoTen: 'Vinh',
      gioiTinh: 'nam',
      laThanhVienHo: true,
      boId: 1,
      meId: 2,
      thuTuAnhChi: 2,
      honNhan: [],
      conCaiIds: [],
    },
    4: {
      id: 4,
      hoTen: 'Nga',
      gioiTinh: 'nu',
      laThanhVienHo: true,
      boId: 1,
      meId: 2,
      thuTuAnhChi: 1,
      honNhan: [],
      conCaiIds: [],
    },
    5: {
      id: 5,
      hoTen: 'Hương',
      gioiTinh: 'nu',
      laThanhVienHo: true,
      thuTuAnhChi: 3,
      honNhan: [{ voChongId: 6 }],
      conCaiIds: [7],
    },
    6: {
      id: 6,
      hoTen: 'Khánh',
      gioiTinh: 'nam',
      laThanhVienHo: false,
      honNhan: [{ voChongId: 5 }],
      conCaiIds: [7],
    },
    7: {
      id: 7,
      hoTen: 'Phúc',
      gioiTinh: 'nam',
      laThanhVienHo: false,
      boId: 6,
      meId: 5,
      thuTuAnhChi: 1,
      honNhan: [],
      conCaiIds: [],
    },
  },
}

describe('ListView spouse rendering', () => {
  beforeEach(() => {
    useGiaphaStore.setState({
      data,
      fileId: 'file-id',
      currentUserEmail: null,
      currentRole: 'public',
      viewMode: 'list',
      selectedPersonId: null,
      isDirty: false,
      isSaving: false,
      conflictDetected: false,
    })
  })

  it('renders non-clan spouse under clan partner without duplicating children branch', () => {
    render(<ListView />)

    expect(screen.getAllByText('Bà Thanh')).toHaveLength(1)
    expect(screen.getAllByText('Vinh')).toHaveLength(1)
    expect(screen.getAllByText('Nga')).toHaveLength(1)
    expect(screen.getAllByText('Khánh')).toHaveLength(1)
    expect(screen.getAllByText('Phúc')).toHaveLength(1)
    expect(screen.getAllByLabelText('Vợ/chồng')).toHaveLength(2)

    const nong = screen.getByText('Ông Nông')
    const thanh = screen.getByText('Bà Thanh')
    const nga = screen.getByText('Nga')
    const vinh = screen.getByText('Vinh')

    expect(nong.compareDocumentPosition(thanh) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(thanh.compareDocumentPosition(nga) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(nga.compareDocumentPosition(vinh) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})
