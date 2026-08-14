import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import PersonCard from './PersonCard'
import { useAuthStore } from '../store/useAuthStore'
import type { Person } from '../types/giapha'

const nguoiMau = (ghiDe: Partial<Person>): Person => ({
  id: '1',
  hoTen: 'Người mẫu',
  gioiTinh: 'nam',
  laThanhVienHo: true,
  honNhan: [],
  conCaiIds: [],
  ...ghiDe,
})

describe('PersonCard', () => {
  it('colors the avatar by gender', () => {
    const { rerender } = render(
      <PersonCard person={nguoiMau({ gioiTinh: 'nam' })} isSelected={false} onClick={() => {}} />
    )
    expect(screen.getByTestId('person-avatar')).toHaveClass('bg-nam')

    rerender(
      <PersonCard person={nguoiMau({ gioiTinh: 'nu' })} isSelected={false} onClick={() => {}} />
    )
    expect(screen.getByTestId('person-avatar')).toHaveClass('bg-nu')
  })

  it('shows the ring badge only for an actual married-in spouse', () => {
    const { rerender } = render(
      <PersonCard person={nguoiMau({ laThanhVienHo: false })} isSelected={false} isSpouse onClick={() => {}} />
    )
    expect(screen.getByLabelText('Vợ/chồng')).toHaveTextContent('💍')

    rerender(
      <PersonCard person={nguoiMau({ laThanhVienHo: true })} isSelected={false} isSpouse onClick={() => {}} />
    )
    expect(screen.queryByLabelText('Vợ/chồng')).not.toBeInTheDocument()
  })

  it('hides the ring badge for a non-clan blood descendant who is not a spouse', () => {
    // e.g. a granddaughter through a daughter's line: laThanhVienHo is false,
    // but she's rendered as a child node, not someone's honNhan spouse.
    render(
      <PersonCard person={nguoiMau({ laThanhVienHo: false })} isSelected={false} isSpouse={false} onClick={() => {}} />
    )
    expect(screen.queryByLabelText('Vợ/chồng')).not.toBeInTheDocument()
  })

  it('gives spouse-slot cards a solid distinct background instead of opacity, so the marriage connector line underneath never bleeds through', () => {
    const { rerender } = render(
      <PersonCard person={nguoiMau({})} isSelected={false} isSpouse onClick={() => {}} />
    )
    const spouseCard = screen.getByText('Người mẫu').closest('div.relative') as HTMLElement
    expect(spouseCard).toHaveClass('bg-card-spouse')
    expect(spouseCard).not.toHaveClass('bg-card')
    expect(spouseCard.style.opacity).toBe('')

    rerender(
      <PersonCard person={nguoiMau({})} isSelected={false} isSpouse={false} onClick={() => {}} />
    )
    const mainCard = screen.getByText('Người mẫu').closest('div.relative') as HTMLElement
    expect(mainCard).toHaveClass('bg-card')
    expect(mainCard).not.toHaveClass('bg-card-spouse')
  })

  it('still applies the selected-accent background on a spouse card', () => {
    render(
      <PersonCard person={nguoiMau({})} isSelected={true} isSpouse onClick={() => {}} />
    )
    const card = screen.getByText('Người mẫu').closest('div.relative') as HTMLElement
    expect(card).toHaveClass('bg-accent-soft', 'outline-accent')
  })

  it('shows an accent outline only when selected', () => {
    const { rerender } = render(
      <PersonCard person={nguoiMau({})} isSelected={true} onClick={() => {}} />
    )
    expect(screen.getByText('Người mẫu').closest('div.relative')).toHaveClass('outline-accent')

    rerender(
      <PersonCard person={nguoiMau({})} isSelected={false} onClick={() => {}} />
    )
    expect(screen.getByText('Người mẫu').closest('div.relative')).not.toHaveClass('outline-accent')
  })

  it('shows the deceased mark only when namMat is set', () => {
    const { rerender } = render(
      <PersonCard person={nguoiMau({ namMat: { nam: 2020 } })} isSelected={false} onClick={() => {}} />
    )
    expect(screen.getByText('†')).toBeInTheDocument()

    rerender(
      <PersonCard person={nguoiMau({ namMat: undefined })} isSelected={false} onClick={() => {}} />
    )
    expect(screen.queryByText('†')).not.toBeInTheDocument()
  })

  it('shows a plain color dot with no letter when there is no photo', () => {
    render(
      <PersonCard person={nguoiMau({ hoTen: 'Nguyễn Văn An' })} isSelected={false} onClick={() => {}} />
    )
    expect(screen.getByTestId('person-avatar')).toHaveTextContent('')
  })

  it('shows the real photo when anhDaiDien is set', () => {
    render(
      <PersonCard person={nguoiMau({ anhDaiDien: '/api/avatars/abc.jpg' })} isSelected={false} onClick={() => {}} />
    )
    expect(screen.getByTestId('person-avatar')).toHaveAttribute('src', '/api/avatars/abc.jpg')
  })

  it('shows ÂL next to a lunar birth date', () => {
    const { rerender } = render(
      <PersonCard person={nguoiMau({ namSinh: { nam: 1930, amLich: true } })} isSelected={false} onClick={() => {}} />
    )
    expect(screen.getByText('ÂL')).toBeInTheDocument()

    rerender(
      <PersonCard person={nguoiMau({ namSinh: { nam: 1930 } })} isSelected={false} onClick={() => {}} />
    )
    expect(screen.queryByText('ÂL')).not.toBeInTheDocument()
  })
})

describe('PersonCard pending-request badge', () => {
  it('shows the badge when logged in and pendingRequestId is set', () => {
    useAuthStore.setState({ user: { id: '1', username: 'ed1', email: 'e@example.com', role: 'editor', personId: null } })
    render(
      <PersonCard person={nguoiMau({ pendingRequestId: 'req-1' })} isSelected={false} onClick={() => {}} />
    )
    expect(screen.getByLabelText('Đang chờ duyệt')).toBeInTheDocument()
  })

  it('hides the badge when logged out even if pendingRequestId is set', () => {
    useAuthStore.setState({ user: null })
    render(
      <PersonCard person={nguoiMau({ pendingRequestId: 'req-1' })} isSelected={false} onClick={() => {}} />
    )
    expect(screen.queryByLabelText('Đang chờ duyệt')).not.toBeInTheDocument()
  })
})
