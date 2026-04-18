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
    nong: {
      id: 'nong',
      hoTen: 'Ông Nông',
      gioiTinh: 'nam',
      laThanhVienHo: true,
      honNhan: [{ voChongId: 'thanh' }],
      conCaiIds: ['vinh', 'nga'],
    },
    thanh: {
      id: 'thanh',
      hoTen: 'Bà Thanh',
      gioiTinh: 'nu',
      laThanhVienHo: false,
      honNhan: [{ voChongId: 'nong' }],
      conCaiIds: ['vinh', 'nga'],
    },
    vinh: {
      id: 'vinh',
      hoTen: 'Vinh',
      gioiTinh: 'nam',
      laThanhVienHo: true,
      boId: 'nong',
      meId: 'thanh',
      thuTuAnhChi: 2,
      honNhan: [],
      conCaiIds: [],
    },
    nga: {
      id: 'nga',
      hoTen: 'Nga',
      gioiTinh: 'nu',
      laThanhVienHo: true,
      boId: 'nong',
      meId: 'thanh',
      thuTuAnhChi: 1,
      honNhan: [],
      conCaiIds: [],
    },
    huong: {
      id: 'huong',
      hoTen: 'Hương',
      gioiTinh: 'nu',
      laThanhVienHo: true,
      thuTuAnhChi: 3,
      honNhan: [{ voChongId: 'khanh' }],
      conCaiIds: ['phuc'],
    },
    khanh: {
      id: 'khanh',
      hoTen: 'Khánh',
      gioiTinh: 'nam',
      laThanhVienHo: false,
      honNhan: [{ voChongId: 'huong' }],
      conCaiIds: ['phuc'],
    },
    phuc: {
      id: 'phuc',
      hoTen: 'Phúc',
      gioiTinh: 'nam',
      laThanhVienHo: false,
      boId: 'khanh',
      meId: 'huong',
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
