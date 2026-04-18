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
    1: { id: 1, hoTen: 'Tổ', gioiTinh: 'nam', laThanhVienHo: true, honNhan: [{ voChongId: 2 }], conCaiIds: [3] },
    2: { id: 2, hoTen: 'Bà', gioiTinh: 'nu', laThanhVienHo: false, honNhan: [{ voChongId: 1 }], conCaiIds: [3] },
    3: { id: 3, hoTen: 'Con gái', gioiTinh: 'nu', laThanhVienHo: true, boId: 1, meId: 2, honNhan: [{ voChongId: 4 }], conCaiIds: [5] },
    4: { id: 4, hoTen: 'Con rể', gioiTinh: 'nam', laThanhVienHo: false, honNhan: [{ voChongId: 3 }], conCaiIds: [5] },
    5: { id: 5, hoTen: 'Cháu gái', gioiTinh: 'nu', laThanhVienHo: false, boId: 4, meId: 3, honNhan: [{ voChongId: 6 }], conCaiIds: [] },
    6: { id: 6, hoTen: 'Chồng cháu gái', gioiTinh: 'nam', laThanhVienHo: false, honNhan: [{ voChongId: 5 }], conCaiIds: [7] },
    7: { id: 7, hoTen: 'Chắt', gioiTinh: 'nam', laThanhVienHo: false, boId: 6, meId: 5, honNhan: [], conCaiIds: [] },
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

  it('zooms in and out with toolbar buttons', () => {
    render(<TreeView />)
    const scaleLayer = screen.getByTestId('tree-view-scale-layer')
    const zoomInButton = screen.getByRole('button', { name: 'Phóng to cây' })
    const zoomOutButton = screen.getByRole('button', { name: 'Thu nhỏ cây' })

    expect(scaleLayer).toHaveStyle({ transform: 'scale(1)' })
    fireEvent.click(zoomInButton)
    expect(scaleLayer).toHaveStyle({ transform: 'scale(1.1)' })

    fireEvent.click(zoomOutButton)
    expect(scaleLayer).toHaveStyle({ transform: 'scale(1)' })
  })

  it('supports ctrl + wheel zooming', () => {
    render(<TreeView />)
    const container = screen.getByTestId('tree-view-container')
    const scaleLayer = screen.getByTestId('tree-view-scale-layer')

    fireEvent.wheel(container, { deltaY: -100, ctrlKey: true, clientX: 200, clientY: 150 })

    expect(scaleLayer).toHaveStyle({ transform: 'scale(1.1)' })
  })

  it('renders descendant connectors in blue with same thickness as couple lines', () => {
    const { container } = render(<TreeView />)
    const svgLines = container.querySelectorAll('svg line')

    expect(svgLines.length).toBeGreaterThan(0)
    expect(container.querySelector('svg line[stroke="#F97316"][stroke-width="2"]')).not.toBeNull()
    expect(container.querySelector('svg line[stroke="#3B82F6"][stroke-width="2"]')).not.toBeNull()
    expect(container.querySelector('svg line[stroke="#CBD5E1"]')).toBeNull()
  })

  it('orders siblings left-to-right from eldest to youngest', () => {
    const siblingData: GiaphaData = {
      ...data,
      persons: {
        ...data.persons,
        1: { ...data.persons[1], conCaiIds: [3, 8] },
        2: { ...data.persons[2], conCaiIds: [3, 8] },
        3: { ...data.persons[3], thuTuAnhChi: 2 },
        8: {
          id: 8,
          hoTen: 'Con cả',
          gioiTinh: 'nam',
          laThanhVienHo: true,
          boId: 1,
          meId: 2,
          thuTuAnhChi: 1,
          honNhan: [],
          conCaiIds: [],
        },
      },
    }
    useGiaphaStore.setState({ data: siblingData })

    render(<TreeView />)
    const eldestCard = screen.getByText('Con cả').closest('div[style*="position: absolute"]') as HTMLDivElement | null
    const youngerCard = screen.getByText('Con gái').closest('div[style*="position: absolute"]') as HTMLDivElement | null

    expect(eldestCard).not.toBeNull()
    expect(youngerCard).not.toBeNull()
    expect(parseFloat((eldestCard as HTMLDivElement).style.left)).toBeLessThan(parseFloat((youngerCard as HTMLDivElement).style.left))
  })
})
