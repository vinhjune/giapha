import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import HomePage from './HomePage'
import { useGiaphaStore } from '../store/useGiaphaStore'
import type { GiaphaData } from '../types/giapha'
import { mockMatchMedia } from '../test-setup'

const data: GiaphaData = {
  metadata: { tenDongHo: 'Dòng họ mẫu' },
  persons: {
    '1': { id: '1', hoTen: 'Tổ', gioiTinh: 'nam', laThanhVienHo: true, honNhan: [], conCaiIds: [] },
  },
}

describe('HomePage person click flow', () => {
  beforeEach(() => {
    // jsdom doesn't implement Element.scrollTo; TreeView's scroll-to-highlighted effect calls it.
    Element.prototype.scrollTo = vi.fn()
    useGiaphaStore.setState({
      data,
      viewMode: 'tree',
      selectedPersonId: null,
      focusedPersonId: null,
      hienThiThuTuDoi: false,
      cyclicRelationshipWarnings: [],
    })
  })

  it('opens the edit modal directly when a tree card is clicked, without an intermediate detail panel', () => {
    render(<HomePage />)

    expect(screen.queryByTestId('person-form-modal')).toBeNull()

    fireEvent.click(screen.getByText('Tổ'))

    expect(screen.getByTestId('person-form-modal')).toBeInTheDocument()
    expect(screen.getByText('Sửa thông tin')).toBeInTheDocument()
    // The old view-only detail panel's own "Sửa" trigger button no longer exists.
    expect(screen.queryByRole('button', { name: 'Sửa' })).toBeNull()
  })

  it('closing the edit modal clears the selection', () => {
    render(<HomePage />)

    fireEvent.click(screen.getByText('Tổ'))
    expect(screen.getByTestId('person-form-modal')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Hủy' }))

    expect(screen.queryByTestId('person-form-modal')).toBeNull()
    expect(useGiaphaStore.getState().selectedPersonId).toBeNull()
  })

  it('opens a blank add-person modal from the + button, unaffected by any selection', () => {
    render(<HomePage />)

    fireEvent.click(screen.getByTitle('Thêm người mới'))

    expect(screen.getByText('Thêm người mới')).toBeInTheDocument()
  })
})

describe('HomePage in-modal relation navigation', () => {
  beforeEach(() => {
    Element.prototype.scrollTo = vi.fn()
  })

  const navData: GiaphaData = {
    metadata: { tenDongHo: 'Dòng họ mẫu' },
    persons: {
      '1': { id: '1', hoTen: 'Ông Nội', gioiTinh: 'nam', laThanhVienHo: true, honNhan: [], conCaiIds: ['2'] },
      '2': { id: '2', hoTen: 'Con Trai', gioiTinh: 'nam', laThanhVienHo: true, boId: '1', honNhan: [], conCaiIds: [] },
    },
  }

  it('navigating to a related member inside the edit modal fully switches the modal content and focuses them in the tree', () => {
    useGiaphaStore.setState({
      data: navData,
      viewMode: 'tree',
      selectedPersonId: null,
      focusedPersonId: null,
      hienThiThuTuDoi: false,
      cyclicRelationshipWarnings: [],
    })

    render(<HomePage />)

    fireEvent.click(screen.getByText('Con Trai'))
    expect(screen.getByDisplayValue('Con Trai')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Ông Nội' }))

    expect(useGiaphaStore.getState().selectedPersonId).toBe('1')
    expect(useGiaphaStore.getState().focusedPersonId).toBe('1')
    expect(screen.getByDisplayValue('Ông Nội')).toBeInTheDocument()
    // Ông Nội không có Bố — nếu modal không remount, tên "Ông Nội" cũ (nút Bố của Con Trai) sẽ còn sót lại.
    expect(screen.queryByRole('button', { name: 'Ông Nội' })).toBeNull()
  })
})

describe('HomePage mobile navigation', () => {
  beforeEach(() => {
    Element.prototype.scrollTo = vi.fn()
    useGiaphaStore.setState({
      data,
      viewMode: 'tree',
      selectedPersonId: null,
      focusedPersonId: null,
      hienThiThuTuDoi: false,
      cyclicRelationshipWarnings: [],
    })
  })

  it('shows the bottom tab bar on mobile and opens the add-person modal from "Thêm mới"', () => {
    mockMatchMedia(true)
    render(<HomePage />)

    expect(screen.getByRole('button', { name: 'Thêm mới' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Thêm mới' }))

    expect(screen.getByText('Thêm người mới')).toBeInTheDocument()
  })

  it('does not show the bottom tab bar on desktop', () => {
    mockMatchMedia(false)
    render(<HomePage />)

    expect(screen.queryByRole('navigation', { name: 'Điều hướng chính' })).toBeNull()
  })

  it('marks the floating add button as desktop-only via CSS classes', () => {
    mockMatchMedia(false)
    render(<HomePage />)

    const fab = screen.getByTitle('Thêm người mới')
    expect(fab.className).toContain('hidden')
    expect(fab.className).toContain('sm:flex')
  })
})
