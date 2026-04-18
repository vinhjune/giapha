import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { tuDongDienMe, tuDongDienBo } from '../utils/familyTree'
import type { GiaphaData } from '../types/giapha'
import type { Person } from '../types/giapha'
import { useGiaphaStore } from '../store/useGiaphaStore'
import PersonForm from './PersonForm'

const data: GiaphaData = {
  metadata: {} as any,
  persons: {
    bo1: { id: 'bo1', hoTen: 'Bố', gioiTinh: 'nam', laThanhVienHo: true, honNhan: [{ voChongId: 'me1' }], conCaiIds: [] },
    me1: { id: 'me1', hoTen: 'Mẹ', gioiTinh: 'nu', laThanhVienHo: false, honNhan: [{ voChongId: 'bo1' }], conCaiIds: [] },
  },
}

describe('PersonForm auto-fill', () => {
  it('selecting father with one wife auto-fills mother', () => {
    expect(tuDongDienMe('bo1', data)).toBe('me1')
  })

  it('selecting mother with one husband auto-fills father', () => {
    expect(tuDongDienBo('me1', data)).toBe('bo1')
  })
})

describe('PersonForm responsive layout', () => {
  it('uses mobile-friendly modal width classes', () => {
    useGiaphaStore.setState({
      data,
      currentUserEmail: null,
    })

    const editPerson: Person = {
      id: 'bo1',
      hoTen: 'Bố',
      gioiTinh: 'nam',
      laThanhVienHo: true,
      honNhan: [{ voChongId: 'me1' }],
      conCaiIds: [],
    }

    const { container } = render(<PersonForm editPerson={editPerson} onClose={() => {}} />)
    const modal = container.querySelector('.fixed.inset-0 > div') as HTMLDivElement | null

    expect(modal).not.toBeNull()
    expect(modal?.className).toContain('w-full')
    expect(modal?.className).toContain('max-w-[480px]')
    expect(modal?.className).toContain('max-h-[100dvh]')
  })
})
