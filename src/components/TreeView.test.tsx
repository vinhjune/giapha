import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import TreeView from './TreeView'
import { useGiaphaStore } from '../store/useGiaphaStore'
import type { GiaphaData } from '../types/giapha'

const data: GiaphaData = {
  metadata: { tenDongHo: 'Dòng họ mẫu' },
  persons: {
    '1': { id: '1', hoTen: 'Tổ', gioiTinh: 'nam', laThanhVienHo: true, thuTuDoi: 1, honNhan: [{ voChongId: '2' }], conCaiIds: ['3'] },
    '2': { id: '2', hoTen: 'Bà', gioiTinh: 'nu', laThanhVienHo: false, thuTuDoi: 1, honNhan: [{ voChongId: '1' }], conCaiIds: ['3'] },
    '3': { id: '3', hoTen: 'Con gái', gioiTinh: 'nu', laThanhVienHo: true, thuTuDoi: 2, boId: '1', meId: '2', honNhan: [{ voChongId: '4' }], conCaiIds: ['5'] },
    '4': { id: '4', hoTen: 'Con rể', gioiTinh: 'nam', laThanhVienHo: false, honNhan: [{ voChongId: '3' }], conCaiIds: ['5'] },
    '5': { id: '5', hoTen: 'Cháu gái', gioiTinh: 'nu', laThanhVienHo: false, boId: '4', meId: '3', honNhan: [{ voChongId: '6' }], conCaiIds: [] },
    '6': { id: '6', hoTen: 'Chồng cháu gái', gioiTinh: 'nam', laThanhVienHo: false, honNhan: [{ voChongId: '5' }], conCaiIds: ['7'] },
    '7': { id: '7', hoTen: 'Chắt', gioiTinh: 'nam', laThanhVienHo: false, boId: '6', meId: '5', honNhan: [], conCaiIds: [] },
  },
}

describe('TreeView', () => {
  beforeEach(() => {
    useGiaphaStore.setState({
      data,
      viewMode: 'tree',
      selectedPersonId: null,
      hienThiThuTuDoi: false,
    })
  })

  it('shows deeply nested descendants under female line', () => {
    render(<TreeView />)
    expect(screen.getByText('Chắt')).toBeInTheDocument()
  })

  it('shows the marriage badge on an actual spouse but not on a non-clan blood descendant', () => {
    render(<TreeView />)

    // 'Bà' is a real spouse (honNhan link to 'Tổ') → badge expected.
    const spouseCard = screen.getByText('Bà').closest('div.relative')!
    expect(spouseCard.querySelector('[aria-label="Vợ/chồng"]')).not.toBeNull()

    // 'Cháu gái' is a granddaughter (child node, laThanhVienHo: false only because
    // she descends through a daughter's line) — not anyone's spouse, so no badge.
    const descendantCard = screen.getByText('Cháu gái').closest('div.relative')!
    expect(descendantCard.querySelector('[aria-label="Vợ/chồng"]')).toBeNull()
  })

  it('shows generation order suffix when setting is enabled', () => {
    useGiaphaStore.setState({ hienThiThuTuDoi: true })

    render(<TreeView />)
    expect(screen.getByText('Tổ (#1)')).toBeInTheDocument()
    expect(screen.getByText('Con gái (#2)')).toBeInTheDocument()
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

  it('renders descendant connectors in ink with same thickness as couple lines', () => {
    const { container } = render(<TreeView />)
    const svgLines = container.querySelectorAll('svg line')

    expect(svgLines.length).toBeGreaterThan(0)
    expect(container.querySelector('svg line[stroke="#7C3AED"][stroke-width="3"]')).not.toBeNull()
    expect(container.querySelector('svg line[stroke="#0F172A"][stroke-width="3"]')).not.toBeNull()
    expect(container.querySelector('svg line[stroke="#CBD5E1"]')).toBeNull()
  })

  it('gives every card wrapper an explicit height matching the connector-line math (NODE_H)', () => {
    render(<TreeView />)
    const nameEl = screen.getByText('Tổ')
    const cardWrapper = nameEl.parentElement!.parentElement!.parentElement!

    // NODE_H = 64 in source: every SVG connector coordinate assumes this exact card height,
    // so the wrapper must set it explicitly rather than let PersonCard's own CSS decide it.
    expect(cardWrapper.style.height).toBe('64px')
  })

  it('sizes cards wide enough to fit long names plus the avatar reservation', () => {
    const longName = 'Nguyễn Thị Phương Thảo Uyên Gia Tộc'
    const longNameData: GiaphaData = {
      metadata: { tenDongHo: 'Dòng họ mẫu' },
      persons: {
        '1': { id: '1', hoTen: longName, gioiTinh: 'nam', laThanhVienHo: true, honNhan: [], conCaiIds: [] },
      },
    }
    useGiaphaStore.setState({
      data: longNameData,
      viewMode: 'tree',
      selectedPersonId: null,
      hienThiThuTuDoi: false,
    })

    render(<TreeView />)
    const nameEl = screen.getByText(longName)
    const cardWrapper = nameEl.parentElement!.parentElement!.parentElement!
    const actualWidth = parseFloat(cardWrapper.style.width)

    // Baseline: what the old text-only formula (no avatar reservation) would have produced
    // (NAME_CHAR_WIDTH_ESTIMATE=8 * name length + NODE_HORIZONTAL_PADDING=20).
    const nameOnlyBudget = longName.trim().length * 8 + 20
    expect(actualWidth).toBeGreaterThan(nameOnlyBudget)
  })

  it('sizes each card to its own name, not the longest name in the tree', () => {
    const shortName = 'An'
    const longName = 'Nguyễn Thị Phương Thảo Uyên Gia Tộc'
    const mixedLengthData: GiaphaData = {
      metadata: { tenDongHo: 'Dòng họ mẫu' },
      persons: {
        '1': { id: '1', hoTen: 'Tổ', gioiTinh: 'nam', laThanhVienHo: true, honNhan: [], conCaiIds: ['2', '3'] },
        '2': { id: '2', hoTen: shortName, gioiTinh: 'nam', laThanhVienHo: true, boId: '1', honNhan: [], conCaiIds: [] },
        '3': { id: '3', hoTen: longName, gioiTinh: 'nu', laThanhVienHo: true, boId: '1', honNhan: [], conCaiIds: [] },
      },
    }
    useGiaphaStore.setState({
      data: mixedLengthData,
      viewMode: 'tree',
      selectedPersonId: null,
      hienThiThuTuDoi: false,
    })

    render(<TreeView />)
    const shortWidth = parseFloat(screen.getByText(shortName).parentElement!.parentElement!.parentElement!.style.width)
    const longWidth = parseFloat(screen.getByText(longName).parentElement!.parentElement!.parentElement!.style.width)

    // A 2-letter name must not be forced as wide as a 30+ character sibling's card.
    expect(shortWidth).toBeLessThan(longWidth)
    // Short name falls back to the card's minimum width (MIN_NODE_W = 140 in source), not a name-derived one.
    expect(shortWidth).toBe(140)
  })

  it('orders siblings left-to-right from eldest to youngest', () => {
    const siblingData: GiaphaData = {
      ...data,
      persons: {
        ...data.persons,
        '1': { ...data.persons['1'], conCaiIds: ['3', '8'] },
        '2': { ...data.persons['2'], conCaiIds: ['3', '8'] },
        '3': { ...data.persons['3'], thuTuAnhChi: 2 },
        '8': {
          id: '8',
          hoTen: 'Con cả',
          gioiTinh: 'nam',
          laThanhVienHo: true,
          boId: '1',
          meId: '2',
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

  it('expands node width for long names and keeps name on a single line', () => {
    const longName = 'Nguyễn Văn Thành Viên Có Tên Rất Dài Để Kiểm Tra Hiển Thị'
    const longNameData: GiaphaData = {
      ...data,
      persons: {
        ...data.persons,
        '1': { ...data.persons['1'], hoTen: longName },
      },
    }
    useGiaphaStore.setState({ data: longNameData })

    render(<TreeView />)
    const longNameText = screen.getByText(longName)
    const card = longNameText.closest('div[style*="position: absolute"]') as HTMLDivElement | null

    expect(card).not.toBeNull()
    expect(parseFloat((card as HTMLDivElement).style.width)).toBeGreaterThan(120)
    expect(longNameText).toHaveClass('whitespace-nowrap')
  })
})
