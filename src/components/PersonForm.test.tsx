import { describe, it, expect, afterEach, vi } from 'vitest'
import { act, fireEvent, render } from '@testing-library/react'
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
  const initialState = useGiaphaStore.getState()

  afterEach(() => {
    act(() => {
      useGiaphaStore.setState(initialState, true)
    })
  })

  it('modal container has responsive width and max-width classes', () => {
    useGiaphaStore.setState({
      data,
      currentUserEmail: null,
      acquireSoftLock: () => {},
      releaseSoftLock: () => {},
    })

    const editPerson: Person = {
      id: 'bo1',
      hoTen: 'Bố',
      gioiTinh: 'nam',
      laThanhVienHo: true,
      honNhan: [{ voChongId: 'me1' }],
      conCaiIds: [],
    }

    const { getByTestId } = render(<PersonForm editPerson={editPerson} onClose={() => {}} />)
    const modal = getByTestId('person-form-modal') as HTMLDivElement

    expect(modal.className).toContain('w-full')
    expect(modal.className).toContain('max-w-[480px]')
    expect(modal.className).toContain('max-h-[100dvh]')
    expect(modal.className).toContain('sm:max-h-[90vh]')
  })
})

describe('PersonForm parent confirmation on add', () => {
  const initialState = useGiaphaStore.getState()

  afterEach(() => {
    act(() => {
      useGiaphaStore.setState(initialState, true)
    })
    vi.restoreAllMocks()
  })

  it('asks for confirmation and stops saving when user cancels', () => {
    const themNguoi = vi.fn()
    const onClose = vi.fn()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)

    useGiaphaStore.setState({
      data,
      themNguoi,
      suaNguoi: vi.fn(),
      acquireSoftLock: () => {},
      releaseSoftLock: () => {},
    })

    const { container } = render(<PersonForm onClose={onClose} />)
    const formEl = container.querySelector('form')
    const nameInput = container.querySelector('input[required]') as HTMLInputElement
    expect(formEl).toBeTruthy()

    fireEvent.change(nameInput, { target: { value: 'Ông Nông' } })
    fireEvent.submit(formEl!)

    expect(confirmSpy).toHaveBeenCalledWith('Chưa nhập đủ thông tin bố và mẹ thành viên. Bạn có thể bổ sung sau. Bạn có chắc muốn lưu không?')
    expect(themNguoi).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('continues saving when user confirms', () => {
    const themNguoi = vi.fn()
    const onClose = vi.fn()
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    useGiaphaStore.setState({
      data,
      themNguoi,
      suaNguoi: vi.fn(),
      acquireSoftLock: () => {},
      releaseSoftLock: () => {},
    })

    const { container } = render(<PersonForm onClose={onClose} />)
    const formEl = container.querySelector('form')
    const nameInput = container.querySelector('input[required]') as HTMLInputElement
    expect(formEl).toBeTruthy()

    fireEvent.change(nameInput, { target: { value: 'Bà Thanh' } })
    fireEvent.submit(formEl!)

    expect(themNguoi).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
