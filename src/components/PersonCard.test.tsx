import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import PersonCard from './PersonCard'
import type { Person } from '../types/giapha'

const nguoiMau = (ghiDe: Partial<Person>): Person => ({
  id: 'p',
  hoTen: 'Người mẫu',
  gioiTinh: 'nam',
  laThanhVienHo: true,
  honNhan: [],
  conCaiIds: [],
  ...ghiDe,
})

describe('PersonCard background colors', () => {
  it('applies background color by gender and clan membership', () => {
    const { rerender } = render(
      <PersonCard person={nguoiMau({ hoTen: 'Nam trong họ', gioiTinh: 'nam', laThanhVienHo: true })} isSelected={false} onClick={() => {}} />
    )
    expect(screen.getByText('Nam trong họ').parentElement).toHaveClass('bg-blue-100')

    rerender(
      <PersonCard person={nguoiMau({ hoTen: 'Nữ trong họ', gioiTinh: 'nu', laThanhVienHo: true })} isSelected={false} onClick={() => {}} />
    )
    expect(screen.getByText('Nữ trong họ').parentElement).toHaveClass('bg-pink-100')

    rerender(
      <PersonCard person={nguoiMau({ hoTen: 'Nam ngoài họ', gioiTinh: 'nam', laThanhVienHo: false })} isSelected={false} onClick={() => {}} />
    )
    expect(screen.getByText('Nam ngoài họ').parentElement).toHaveClass('bg-purple-100')

    rerender(
      <PersonCard person={nguoiMau({ hoTen: 'Nữ ngoài họ', gioiTinh: 'nu', laThanhVienHo: false })} isSelected={false} onClick={() => {}} />
    )
    expect(screen.getByText('Nữ ngoài họ').parentElement).toHaveClass('bg-yellow-100')
  })
})
