import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import PersonDetailPanel from './PersonDetailPanel'
import type { Person } from '../types/giapha'

const person: Person = {
  id: '1', hoTen: 'Nguyễn Văn A', gioiTinh: 'nam', laThanhVienHo: true,
  honNhan: [], conCaiIds: [], tieuSu: 'Một người tốt bụng', queQuan: 'Hà Nội',
}

describe('PersonDetailPanel', () => {
  it('renders person info without any edit/delete controls', () => {
    render(<PersonDetailPanel person={person} onClose={vi.fn()} />)
    expect(screen.getByText('Nguyễn Văn A')).toBeInTheDocument()
    expect(screen.getByText('Một người tốt bụng')).toBeInTheDocument()
    expect(screen.getByText(/Hà Nội/)).toBeInTheDocument()
    expect(screen.queryByText('Sửa')).not.toBeInTheDocument()
    expect(screen.queryByText('Xóa')).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn()
    render(<PersonDetailPanel person={person} onClose={onClose} />)
    screen.getByLabelText('Đóng').click()
    expect(onClose).toHaveBeenCalled()
  })
})
