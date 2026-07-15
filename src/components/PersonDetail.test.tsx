import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import PersonDetail from './PersonDetail'
import { useGiaphaStore } from '../store/useGiaphaStore'
import type { GiaphaData } from '../types/giapha'

const data: GiaphaData = {
  metadata: { tenDongHo: 'Dòng họ mẫu' },
  persons: {
    '1': { id: '1', hoTen: 'Nguyễn Văn A', gioiTinh: 'nam', laThanhVienHo: true, honNhan: [], conCaiIds: [] },
  },
}

describe('PersonDetail edit/delete actions', () => {
  beforeEach(() => {
    useGiaphaStore.setState({
      data,
      viewMode: 'tree',
      selectedPersonId: '1',
    })
  })

  it('always shows edit and delete buttons', () => {
    render(<PersonDetail onEdit={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Sửa' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Xóa' })).toBeInTheDocument()
  })
})

describe('PersonDetail contact info', () => {
  beforeEach(() => {
    useGiaphaStore.setState({
      data: {
        metadata: { tenDongHo: 'Dòng họ mẫu' },
        persons: {
          '1': {
            id: '1',
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
      selectedPersonId: '1',
      viewMode: 'tree',
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
      useGiaphaStore.setState({ selectedPersonId: '1' })
    })

    expect(screen.getByText('Người Có Liên Hệ')).toBeInTheDocument()
  })
})
