import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import TreeView from './TreeView'
import { useGiaphaStore } from '../store/useGiaphaStore'
import type { GiaphaData } from '../types/giapha'

const data: GiaphaData = {
  metadata: {
    tenDongHo: 'Dòng họ mẫu',
    ngayTao: '2026-01-01T00:00:00.000Z',
    nguoiTao: 'admin@example.com',
    phienBan: 1,
    cheDoCong: false,
    danhSachNguoiDung: [],
  },
  persons: {
    p1: { id: 'p1', hoTen: 'Tổ', gioiTinh: 'nam', laThanhVienHo: true, honNhan: [{ voChongId: 'p2' }], conCaiIds: ['p3'] },
    p2: { id: 'p2', hoTen: 'Bà', gioiTinh: 'nu', laThanhVienHo: false, honNhan: [{ voChongId: 'p1' }], conCaiIds: ['p3'] },
    p3: { id: 'p3', hoTen: 'Con gái', gioiTinh: 'nu', laThanhVienHo: true, boId: 'p1', meId: 'p2', honNhan: [{ voChongId: 'p4' }], conCaiIds: ['p5'] },
    p4: { id: 'p4', hoTen: 'Con rể', gioiTinh: 'nam', laThanhVienHo: false, honNhan: [{ voChongId: 'p3' }], conCaiIds: ['p5'] },
    p5: { id: 'p5', hoTen: 'Cháu gái', gioiTinh: 'nu', laThanhVienHo: false, boId: 'p4', meId: 'p3', honNhan: [{ voChongId: 'p6' }], conCaiIds: [] },
    p6: { id: 'p6', hoTen: 'Chồng cháu gái', gioiTinh: 'nam', laThanhVienHo: false, honNhan: [{ voChongId: 'p5' }], conCaiIds: ['p7'] },
    p7: { id: 'p7', hoTen: 'Chắt', gioiTinh: 'nam', laThanhVienHo: false, boId: 'p6', meId: 'p5', honNhan: [], conCaiIds: [] },
  },
}

describe('TreeView', () => {
  beforeEach(() => {
    useGiaphaStore.setState({
      data,
      fileId: null,
      currentUserEmail: null,
      currentRole: 'viewer',
      viewMode: 'tree',
      selectedPersonId: null,
      isDirty: false,
      isSaving: false,
      conflictDetected: false,
    })
  })

  it('shows deeply nested descendants under female line', () => {
    render(<TreeView />)
    expect(screen.getByText('Chắt')).toBeInTheDocument()
  })

  it('allows panning with mouse drag on desktop', () => {
    render(<TreeView />)
    const container = screen.getByTestId('tree-view-container')

    container.scrollLeft = 120
    container.scrollTop = 80

    fireEvent.mouseDown(container, { button: 0, clientX: 300, clientY: 200 })
    fireEvent.mouseMove(container, { clientX: 260, clientY: 170 })
    fireEvent.mouseUp(container)

    expect(container.scrollLeft).toBe(160)
    expect(container.scrollTop).toBe(110)
  })

  it('supports keyboard panning with arrow keys', () => {
    render(<TreeView />)
    const container = screen.getByTestId('tree-view-container')

    container.scrollLeft = 120
    container.focus()
    fireEvent.keyDown(container, { key: 'ArrowRight' })

    expect(container.scrollLeft).toBe(180)
  })
})
