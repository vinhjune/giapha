import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import PersonCard from './PersonCard'
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

  it('shows the last name-part initial in the avatar', () => {
    render(
      <PersonCard person={nguoiMau({ hoTen: 'Nguyễn Văn An' })} isSelected={false} onClick={() => {}} />
    )
    expect(screen.getByTestId('person-avatar')).toHaveTextContent('A')
  })
})
