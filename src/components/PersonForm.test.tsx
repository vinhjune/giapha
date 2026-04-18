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
    1: { id: 1, hoTen: 'Bố', gioiTinh: 'nam', laThanhVienHo: true, honNhan: [{ voChongId: 2 }], conCaiIds: [] },
    2: { id: 2, hoTen: 'Mẹ', gioiTinh: 'nu', laThanhVienHo: false, honNhan: [{ voChongId: 1 }], conCaiIds: [] },
  },
}

describe('PersonForm auto-fill', () => {
  it('selecting father with one wife auto-fills mother', () => {
    expect(tuDongDienMe(1, data)).toBe(2)
  })

  it('selecting mother with one husband auto-fills father', () => {
    expect(tuDongDienBo(2, data)).toBe(1)
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
      id: 1,
      hoTen: 'Bố',
      gioiTinh: 'nam',
      laThanhVienHo: true,
      honNhan: [{ voChongId: 2 }],
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

describe('PersonForm outside-clan marker', () => {
  const initialState = useGiaphaStore.getState()

  afterEach(() => {
    act(() => {
      useGiaphaStore.setState(initialState, true)
    })
    vi.restoreAllMocks()
  })

  it('shows outside-clan checkbox unchecked by default for new person', () => {
    useGiaphaStore.setState({
      data,
      acquireSoftLock: () => {},
      releaseSoftLock: () => {},
    })

    const { getByLabelText } = render(<PersonForm onClose={() => {}} />)
    const outsideCheckbox = getByLabelText('Người ngoài họ') as HTMLInputElement

    expect(outsideCheckbox.checked).toBe(false)
  })

  it('auto-checks outside-clan when selecting an in-clan spouse while adding', () => {
    useGiaphaStore.setState({
      data,
      acquireSoftLock: () => {},
      releaseSoftLock: () => {},
    })

    const { getByText, getByLabelText, getAllByText } = render(<PersonForm onClose={() => {}} />)

    fireEvent.click(getByText('+ Thêm vợ/chồng'))
    fireEvent.click(getByText('Chọn vợ/chồng'))
    fireEvent.click(getAllByText('Bố')[1])

    const outsideCheckbox = getByLabelText('Người ngoài họ') as HTMLInputElement
    expect(outsideCheckbox.checked).toBe(true)
  })

  it('allows user to uncheck outside-clan after auto-check before saving', () => {
    const themNguoi = vi.fn()
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    useGiaphaStore.setState({
      data,
      themNguoi,
      suaNguoi: vi.fn(),
      acquireSoftLock: () => {},
      releaseSoftLock: () => {},
    })

    const { container, getByText, getByLabelText, getAllByText } = render(<PersonForm onClose={() => {}} />)
    const nameInput = container.querySelector('input[required]') as HTMLInputElement

    fireEvent.change(nameInput, { target: { value: 'Người mới' } })
    fireEvent.click(getByText('+ Thêm vợ/chồng'))
    fireEvent.click(getByText('Chọn vợ/chồng'))
    fireEvent.click(getAllByText('Bố')[1])

    const outsideCheckbox = getByLabelText('Người ngoài họ') as HTMLInputElement
    expect(outsideCheckbox.checked).toBe(true)
    fireEvent.click(outsideCheckbox)
    expect(outsideCheckbox.checked).toBe(false)

    fireEvent.submit(container.querySelector('form')!)

    expect(themNguoi).toHaveBeenCalledWith(expect.objectContaining({ laThanhVienHo: true }))
  })

  it('shows current outside-clan state when editing', () => {
    useGiaphaStore.setState({
      data,
      acquireSoftLock: () => {},
      releaseSoftLock: () => {},
    })

    const editPerson: Person = {
      id: 2,
      hoTen: 'Mẹ',
      gioiTinh: 'nu',
      laThanhVienHo: false,
      honNhan: [{ voChongId: 1 }],
      conCaiIds: [],
    }

    const { getByLabelText } = render(<PersonForm editPerson={editPerson} onClose={() => {}} />)
    const outsideCheckbox = getByLabelText('Người ngoài họ') as HTMLInputElement

    expect(outsideCheckbox.checked).toBe(true)
  })
})
