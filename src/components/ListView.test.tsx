import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import ListView from './ListView'
import { useGiaphaStore } from '../store/useGiaphaStore'
import { useAuthStore } from '../store/useAuthStore'
import type { GiaphaData } from '../types/giapha'

const data: GiaphaData = {
  metadata: { tenDongHo: 'Dòng họ mẫu' },
  persons: {
    '1': {
      id: '1', hoTen: 'Ông Nông', gioiTinh: 'nam', laThanhVienHo: true,
      thuTuDoi: 1, honNhan: [{ voChongId: '2' }], conCaiIds: ['3', '4'],
    },
    '2': {
      id: '2', hoTen: 'Bà Thanh', gioiTinh: 'nu', laThanhVienHo: false,
      thuTuDoi: 1, honNhan: [{ voChongId: '1' }], conCaiIds: ['3', '4'],
    },
    '3': {
      id: '3', hoTen: 'Vinh', gioiTinh: 'nam', laThanhVienHo: true,
      boId: '1', meId: '2', thuTuAnhChi: 2, thuTuDoi: 2, honNhan: [], conCaiIds: [],
    },
    '4': {
      id: '4', hoTen: 'Nga', gioiTinh: 'nu', laThanhVienHo: true,
      boId: '1', meId: '2', thuTuAnhChi: 1, thuTuDoi: 2, honNhan: [], conCaiIds: [],
    },
    '5': {
      id: '5', hoTen: 'Hương', gioiTinh: 'nu', laThanhVienHo: true,
      thuTuAnhChi: 3, honNhan: [{ voChongId: '6' }], conCaiIds: ['7'],
    },
    '6': {
      id: '6', hoTen: 'Khánh', gioiTinh: 'nam', laThanhVienHo: false,
      honNhan: [{ voChongId: '5' }], conCaiIds: ['7'],
    },
    '7': {
      id: '7', hoTen: 'Phúc', gioiTinh: 'nam', laThanhVienHo: false,
      boId: '6', meId: '5', thuTuAnhChi: 1, honNhan: [], conCaiIds: [],
    },
  },
}

describe('ListView spouse rendering', () => {
  beforeEach(() => {
    useGiaphaStore.setState({
      data,
      viewMode: 'list',
      selectedPersonId: null,
      hienThiThuTuDoi: false,
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

  it('shows generation order suffix when setting is enabled', () => {
    useGiaphaStore.setState({ hienThiThuTuDoi: true })

    render(<ListView />)

    expect(screen.getByText('Ông Nông (#1)')).toBeInTheDocument()
    expect(screen.getByText('Bà Thanh (#1)')).toBeInTheDocument()
    expect(screen.getByText('Vinh (#2)')).toBeInTheDocument()
  })

  it('renders safely when data changes from empty to loaded', () => {
    act(() => {
      useGiaphaStore.setState({ data: null })
    })
    const { rerender } = render(<ListView />)

    expect(screen.getByText('Chưa có dữ liệu')).toBeInTheDocument()

    act(() => {
      useGiaphaStore.setState({ data })
      rerender(<ListView />)
    })

    expect(screen.getByText('Ông Nông')).toBeInTheDocument()
  })

  it('prevents infinite recursion when child relationships contain a cycle', () => {
    const cyclicData: GiaphaData = {
      ...data,
      persons: {
        '1': { ...data.persons['1'], conCaiIds: ['3'] },
        '2': data.persons['2'],
        '3': { ...data.persons['3'], conCaiIds: ['1'] },
      },
    }

    useGiaphaStore.setState({ data: cyclicData })

    expect(() => render(<ListView />)).not.toThrow()
    expect(screen.getAllByText('Ông Nông')).toHaveLength(1)
    expect(screen.getAllByText('Vinh')).toHaveLength(1)
  })

  it('dims non-clan members regardless of gender (male spouse dims same as female spouse)', () => {
    render(<ListView />)

    // 'Bà Thanh' (female, laThanhVienHo: false) — married-in wife, dimmed.
    const thanh = screen.getByText('Bà Thanh')
    expect(thanh.className).toContain('text-muted')

    // 'Khánh' (male, laThanhVienHo: false) — married-in husband, must dim the same way.
    const khanh = screen.getByText('Khánh')
    expect(khanh.className).toContain('text-muted')

    // 'Phúc' (male, laThanhVienHo: false, blood descendant through non-clan father) also dims.
    const phuc = screen.getByText('Phúc')
    expect(phuc.className).toContain('text-muted')

    // Actual clan members (regardless of gender) stay un-dimmed.
    const vinh = screen.getByText('Vinh')
    expect(vinh.className).toContain('text-ink')
    const nga = screen.getByText('Nga')
    expect(nga.className).toContain('text-ink')
  })

  it('indents a married-in spouse at the same level as their clan partner, not the children', () => {
    render(<ListView />)

    const nong = screen.getByText('Ông Nông').closest('[data-person-id]') as HTMLElement
    const thanh = screen.getByText('Bà Thanh').closest('[data-person-id]') as HTMLElement
    const vinh = screen.getByText('Vinh').closest('[data-person-id]') as HTMLElement

    // Spouse row shares the same indentation (padding-left) as the clan partner...
    expect(thanh.style.paddingLeft).toBe(nong.style.paddingLeft)
    // ...while the children are indented one level further in.
    expect(vinh.style.paddingLeft).not.toBe(nong.style.paddingLeft)
  })

  it('groups each spouse with only their own children, in marriage order', () => {
    const multiSpouseData: GiaphaData = {
      metadata: { tenDongHo: 'Dòng họ mẫu' },
      persons: {
        '10': {
          id: '10', hoTen: 'Ông Đa', gioiTinh: 'nam', laThanhVienHo: true,
          honNhan: [{ voChongId: '11' }, { voChongId: '12' }], conCaiIds: ['13', '14', '15'],
        },
        '11': {
          id: '11', hoTen: 'Bà Một', gioiTinh: 'nu', laThanhVienHo: false,
          honNhan: [{ voChongId: '10' }], conCaiIds: ['13', '14'],
        },
        '12': {
          id: '12', hoTen: 'Bà Hai', gioiTinh: 'nu', laThanhVienHo: false,
          honNhan: [{ voChongId: '10' }], conCaiIds: ['15'],
        },
        '13': {
          id: '13', hoTen: 'Con D', gioiTinh: 'nam', laThanhVienHo: true,
          boId: '10', meId: '11', thuTuAnhChi: 1, honNhan: [], conCaiIds: [],
        },
        '14': {
          id: '14', hoTen: 'Con E', gioiTinh: 'nam', laThanhVienHo: true,
          boId: '10', meId: '11', thuTuAnhChi: 2, honNhan: [], conCaiIds: [],
        },
        '15': {
          id: '15', hoTen: 'Con J', gioiTinh: 'nam', laThanhVienHo: true,
          boId: '10', meId: '12', thuTuAnhChi: 1, honNhan: [], conCaiIds: [],
        },
      },
    }

    useGiaphaStore.setState({ data: multiSpouseData })
    render(<ListView />)

    const da = screen.getByText('Ông Đa')
    const mot = screen.getByText('Bà Một')
    const d = screen.getByText('Con D')
    const e = screen.getByText('Con E')
    const hai = screen.getByText('Bà Hai')
    const j = screen.getByText('Con J')

    const isBefore = (a: HTMLElement, b: HTMLElement) =>
      Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)

    expect(isBefore(da, mot)).toBe(true)
    expect(isBefore(mot, d)).toBe(true)
    expect(isBefore(d, e)).toBe(true)
    expect(isBefore(e, hai)).toBe(true)
    expect(isBefore(hai, j)).toBe(true)
  })
})

describe('ListView scroll-to-focus', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn()
    useGiaphaStore.setState({
      data,
      viewMode: 'list',
      selectedPersonId: null,
      focusedPersonId: null,
      hienThiThuTuDoi: false,
    })
  })

  it('scrolls the focused person row into view', () => {
    const { rerender } = render(<ListView />)
    const row = screen.getByText('Vinh').closest('[data-person-id]') as HTMLElement
    expect(row.scrollIntoView).not.toHaveBeenCalled()

    act(() => {
      useGiaphaStore.setState({ focusedPersonId: '3' })
    })
    rerender(<ListView />)

    expect(row.scrollIntoView).toHaveBeenCalledWith(expect.objectContaining({ block: 'center' }))
  })
})

describe('ListView pending-request badge', () => {
  beforeEach(() => {
    useGiaphaStore.setState({
      data: {
        metadata: data.metadata,
        persons: { ...data.persons, '3': { ...data.persons['3'], pendingRequestId: 'req-1' } },
      },
      viewMode: 'list',
      selectedPersonId: null,
      hienThiThuTuDoi: false,
    })
  })

  it('shows a pending badge on a row when logged in and the person has pendingRequestId', () => {
    useAuthStore.setState({ user: { id: '1', username: 'ed1', email: 'e@example.com', role: 'editor', personId: null } })
    render(<ListView />)
    expect(screen.getByLabelText('Đang chờ duyệt')).toBeInTheDocument()
  })

  it('hides the pending badge when logged out', () => {
    useAuthStore.setState({ user: null })
    render(<ListView />)
    expect(screen.queryByLabelText('Đang chờ duyệt')).not.toBeInTheDocument()
  })
})
