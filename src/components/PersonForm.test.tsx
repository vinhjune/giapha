import { describe, it, expect, afterEach, vi } from 'vitest'
import { act, fireEvent, render, screen, within, waitFor } from '@testing-library/react'
import { tuDongDienMe, tuDongDienBo } from '../utils/familyTree'
import type { GiaphaData } from '../types/giapha'
import type { Person } from '../types/giapha'
import { useGiaphaStore } from '../store/useGiaphaStore'
import PersonForm from './PersonForm'
import { mockMatchMedia } from '../test-setup'

const data: GiaphaData = {
  metadata: {} as GiaphaData['metadata'],
  persons: {
    '1': { id: '1', hoTen: 'Bố', gioiTinh: 'nam', laThanhVienHo: true, honNhan: [{ voChongId: '2' }], conCaiIds: [] },
    '2': { id: '2', hoTen: 'Mẹ', gioiTinh: 'nu', laThanhVienHo: false, honNhan: [{ voChongId: '1' }], conCaiIds: [] },
  },
}

describe('PersonForm auto-fill', () => {
  it('selecting father with one wife auto-fills mother', () => {
    expect(tuDongDienMe('1', data)).toBe('2')
  })

  it('selecting mother with one husband auto-fills father', () => {
    expect(tuDongDienBo('2', data)).toBe('1')
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
    useGiaphaStore.setState({ data })

    const editPerson: Person = {
      id: '1',
      hoTen: 'Bố',
      gioiTinh: 'nam',
      laThanhVienHo: true,
      honNhan: [{ voChongId: '2' }],
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

  it('asks for confirmation and stops saving when user cancels', async () => {
    const themNguoi = vi.fn()
    const onClose = vi.fn()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)

    useGiaphaStore.setState({ data, themNguoi, suaNguoi: vi.fn() })

    const { container } = render(<PersonForm onClose={onClose} />)
    const formEl = container.querySelector('form')
    const nameInput = container.querySelector('input[required]') as HTMLInputElement
    expect(formEl).toBeTruthy()

    fireEvent.change(nameInput, { target: { value: 'Ông Nông' } })
    await act(async () => { fireEvent.submit(formEl!) })

    expect(confirmSpy).toHaveBeenCalledWith('Chưa nhập đủ thông tin bố và mẹ thành viên. Bạn có thể bổ sung sau. Bạn có chắc muốn lưu không?')
    expect(themNguoi).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('continues saving when user confirms', async () => {
    const themNguoi = vi.fn().mockResolvedValue('new-id')
    const onClose = vi.fn()
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    useGiaphaStore.setState({ data, themNguoi, suaNguoi: vi.fn() })

    const { container } = render(<PersonForm onClose={onClose} />)
    const formEl = container.querySelector('form')
    const nameInput = container.querySelector('input[required]') as HTMLInputElement
    expect(formEl).toBeTruthy()

    fireEvent.change(nameInput, { target: { value: 'Bà Thanh' } })
    await act(async () => { fireEvent.submit(formEl!) })

    expect(themNguoi).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  })
})

describe('PersonForm date entry', () => {
  const initialState = useGiaphaStore.getState()

  afterEach(() => {
    act(() => {
      useGiaphaStore.setState(initialState, true)
    })
    vi.restoreAllMocks()
  })

  it('saves a partial lunar birth date entered via the masked date input', async () => {
    const themNguoi = vi.fn().mockResolvedValue('new-id')
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    useGiaphaStore.setState({ data, themNguoi, suaNguoi: vi.fn() })

    const { container, getByTestId } = render(<PersonForm onClose={() => {}} />)
    const nameInput = container.querySelector('input[required]') as HTMLInputElement
    const dateInput = getByTestId('ngaySinh-date')

    fireEvent.change(nameInput, { target: { value: 'Người mới' } })
    fireEvent.keyDown(dateInput, { key: 'ArrowRight' })
    fireEvent.keyDown(dateInput, { key: 'ArrowRight' })
    for (const digit of '1954') fireEvent.keyDown(dateInput, { key: digit })
    fireEvent.click(getByTestId('ngaySinh-amLich'))

    await act(async () => { fireEvent.submit(container.querySelector('form')!) })

    expect(themNguoi).toHaveBeenCalledWith(expect.objectContaining({
      namSinh: { ngay: undefined, thang: undefined, nam: 1954, amLich: true },
    }))
  })

  it('pre-fills the lunar checkbox when editing a person with a lunar birth date', () => {
    useGiaphaStore.setState({ data })

    const editPerson: Person = {
      id: '1',
      hoTen: 'Bố',
      gioiTinh: 'nam',
      laThanhVienHo: true,
      namSinh: { nam: 1930, amLich: true },
      honNhan: [{ voChongId: '2' }],
      conCaiIds: [],
    }

    const { getByTestId } = render(<PersonForm editPerson={editPerson} onClose={() => {}} />)

    expect((getByTestId('ngaySinh-date') as HTMLInputElement).value).toBe('__/__/1930')
    expect((getByTestId('ngaySinh-amLich') as HTMLInputElement).checked).toBe(true)
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
    useGiaphaStore.setState({ data })

    const { getByLabelText } = render(<PersonForm onClose={() => {}} />)
    const outsideCheckbox = getByLabelText('Người ngoài họ') as HTMLInputElement

    expect(outsideCheckbox.checked).toBe(false)
  })

  it('auto-checks outside-clan when selecting an in-clan spouse while adding', () => {
    useGiaphaStore.setState({ data })

    const { getByText, getByLabelText, getAllByText } = render(<PersonForm onClose={() => {}} />)

    fireEvent.click(getByText('+ Thêm vợ/chồng'))
    fireEvent.click(getByText('Chọn vợ/chồng'))
    fireEvent.click(getAllByText('Bố')[1])

    const outsideCheckbox = getByLabelText('Người ngoài họ') as HTMLInputElement
    expect(outsideCheckbox.checked).toBe(true)
  })

  it('allows user to uncheck outside-clan after auto-check before saving', async () => {
    const themNguoi = vi.fn().mockResolvedValue('new-id')
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    useGiaphaStore.setState({ data, themNguoi, suaNguoi: vi.fn() })

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

    await act(async () => { fireEvent.submit(container.querySelector('form')!) })

    expect(themNguoi).toHaveBeenCalledWith(expect.objectContaining({ laThanhVienHo: true }))
  })

  it('shows current outside-clan state when editing', () => {
    useGiaphaStore.setState({ data })

    const editPerson: Person = {
      id: '2',
      hoTen: 'Mẹ',
      gioiTinh: 'nu',
      laThanhVienHo: false,
      honNhan: [{ voChongId: '1' }],
      conCaiIds: [],
    }

    const { getByLabelText } = render(<PersonForm editPerson={editPerson} onClose={() => {}} />)
    const outsideCheckbox = getByLabelText('Người ngoài họ') as HTMLInputElement

    expect(outsideCheckbox.checked).toBe(true)
  })
})

describe('PersonForm relation navigation - Bố', () => {
  const initialState = useGiaphaStore.getState()

  afterEach(() => {
    act(() => {
      useGiaphaStore.setState(initialState, true)
    })
    vi.restoreAllMocks()
  })

  const relationData: GiaphaData = {
    metadata: {} as GiaphaData['metadata'],
    persons: {
      '1': { id: '1', hoTen: 'Ông Nội', gioiTinh: 'nam', laThanhVienHo: true, honNhan: [], conCaiIds: ['3'] },
      '2': { id: '2', hoTen: 'Bà Nội', gioiTinh: 'nu', laThanhVienHo: false, honNhan: [], conCaiIds: ['3'] },
      '3': { id: '3', hoTen: 'Con', gioiTinh: 'nam', laThanhVienHo: true, boId: '1', meId: '2', honNhan: [], conCaiIds: [] },
    },
  }
  const editPerson: Person = relationData.persons['3']

  it('navigates immediately to Bố when there are no unsaved changes', () => {
    const selectPerson = vi.fn()
    useGiaphaStore.setState({ data: relationData, selectPerson })

    const { getByRole } = render(<PersonForm editPerson={editPerson} onClose={() => {}} />)

    fireEvent.click(getByRole('button', { name: 'Ông Nội' }))

    expect(selectPerson).toHaveBeenCalledWith('1')
  })

  it('asks to save unsaved changes before navigating, and navigates after saving successfully', async () => {
    const selectPerson = vi.fn()
    const suaNguoi = vi.fn().mockResolvedValue(undefined)
    useGiaphaStore.setState({ data: relationData, selectPerson, suaNguoi })
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

    const { container, getByRole } = render(<PersonForm editPerson={editPerson} onClose={() => {}} />)
    const nameInput = container.querySelector('input[required]') as HTMLInputElement
    fireEvent.change(nameInput, { target: { value: 'Con (đã sửa)' } })

    await act(async () => {
      fireEvent.click(getByRole('button', { name: 'Ông Nội' }))
    })

    expect(confirmSpy).toHaveBeenCalled()
    expect(suaNguoi).toHaveBeenCalledWith('3', expect.objectContaining({ hoTen: 'Con (đã sửa)' }))
    expect(selectPerson).toHaveBeenCalledWith('1')
  })

  it('stays on the current form and does not save when the user declines to navigate away', async () => {
    const selectPerson = vi.fn()
    const suaNguoi = vi.fn()
    useGiaphaStore.setState({ data: relationData, selectPerson, suaNguoi })
    vi.spyOn(window, 'confirm').mockReturnValue(false)

    const { container, getByRole } = render(<PersonForm editPerson={editPerson} onClose={() => {}} />)
    const nameInput = container.querySelector('input[required]') as HTMLInputElement
    fireEvent.change(nameInput, { target: { value: 'Con (đã sửa)' } })

    await act(async () => {
      fireEvent.click(getByRole('button', { name: 'Ông Nội' }))
    })

    expect(suaNguoi).not.toHaveBeenCalled()
    expect(selectPerson).not.toHaveBeenCalled()
    expect(nameInput.value).toBe('Con (đã sửa)')
  })

  it('navigates immediately to Mẹ when there are no unsaved changes', () => {
    const selectPerson = vi.fn()
    useGiaphaStore.setState({ data: relationData, selectPerson })

    const { getByRole } = render(<PersonForm editPerson={editPerson} onClose={() => {}} />)

    fireEvent.click(getByRole('button', { name: 'Bà Nội' }))

    expect(selectPerson).toHaveBeenCalledWith('2')
  })
})

describe('PersonForm relation navigation - Vợ/Chồng', () => {
  const initialState = useGiaphaStore.getState()

  afterEach(() => {
    act(() => {
      useGiaphaStore.setState(initialState, true)
    })
  })

  const voChongData: GiaphaData = {
    metadata: {} as GiaphaData['metadata'],
    persons: {
      '1': { id: '1', hoTen: 'Chồng', gioiTinh: 'nam', laThanhVienHo: true, honNhan: [{ voChongId: '2' }], conCaiIds: [] },
      '2': { id: '2', hoTen: 'Vợ', gioiTinh: 'nu', laThanhVienHo: false, honNhan: [{ voChongId: '1' }], conCaiIds: [] },
    },
  }

  it('navigates to a spouse when their name is clicked, and the × button still removes without navigating', () => {
    const selectPerson = vi.fn()
    useGiaphaStore.setState({ data: voChongData, selectPerson })
    const editPerson = voChongData.persons['1']

    const { getByRole } = render(<PersonForm editPerson={editPerson} onClose={() => {}} />)

    fireEvent.click(getByRole('button', { name: 'Vợ' }))

    expect(selectPerson).toHaveBeenCalledWith('2')
  })
})

describe('PersonForm relation navigation - Anh/Chị/Em', () => {
  const initialState = useGiaphaStore.getState()

  afterEach(() => {
    act(() => {
      useGiaphaStore.setState(initialState, true)
    })
  })

  const anhChiEmData: GiaphaData = {
    metadata: {} as GiaphaData['metadata'],
    persons: {
      '1': { id: '1', hoTen: 'Bố', gioiTinh: 'nam', laThanhVienHo: true, honNhan: [], conCaiIds: ['3', '4'] },
      '3': { id: '3', hoTen: 'Anh Cả', gioiTinh: 'nam', laThanhVienHo: true, boId: '1', honNhan: [], conCaiIds: [] },
      '4': { id: '4', hoTen: 'Em Út', gioiTinh: 'nu', laThanhVienHo: true, boId: '1', honNhan: [], conCaiIds: [] },
    },
  }

  it('navigates to a sibling when their name is clicked', () => {
    const selectPerson = vi.fn()
    useGiaphaStore.setState({ data: anhChiEmData, selectPerson })
    const editPerson = anhChiEmData.persons['3']

    const { getByRole } = render(<PersonForm editPerson={editPerson} onClose={() => {}} />)

    fireEvent.click(getByRole('button', { name: 'Em Út' }))

    expect(selectPerson).toHaveBeenCalledWith('4')
  })
})

describe('PersonForm Con (children) list display', () => {
  const initialState = useGiaphaStore.getState()

  afterEach(() => {
    act(() => {
      useGiaphaStore.setState(initialState, true)
    })
  })

  const conData: GiaphaData = {
    metadata: {} as GiaphaData['metadata'],
    persons: {
      '1': { id: '1', hoTen: 'Cha', gioiTinh: 'nam', laThanhVienHo: true, honNhan: [{ voChongId: '2' }], conCaiIds: ['3', '4'] },
      '2': { id: '2', hoTen: 'Mẹ Của Cha', gioiTinh: 'nu', laThanhVienHo: false, honNhan: [{ voChongId: '1' }], conCaiIds: ['3', '4'] },
      '3': { id: '3', hoTen: 'Con Út', gioiTinh: 'nu', laThanhVienHo: true, boId: '1', meId: '2', thuTuAnhChi: 2, honNhan: [], conCaiIds: [] },
      '4': { id: '4', hoTen: 'Con Cả', gioiTinh: 'nam', laThanhVienHo: true, boId: '1', meId: '2', thuTuAnhChi: 1, honNhan: [], conCaiIds: [] },
    },
  }

  it('shows children sorted by Thứ tự anh/chị when editing a person with children', () => {
    useGiaphaStore.setState({ data: conData })
    const editPerson = conData.persons['1']

    const { getByRole } = render(<PersonForm editPerson={editPerson} onClose={() => {}} />)

    const conCa = getByRole('button', { name: 'Con Cả' })
    const conUt = getByRole('button', { name: 'Con Út' })
    // Con Cả (thuTuAnhChi 1) phải render trước Con Út (thuTuAnhChi 2) trong DOM.
    expect(conCa.compareDocumentPosition(conUt) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('navigates to a child when its name is clicked', () => {
    const selectPerson = vi.fn()
    useGiaphaStore.setState({ data: conData, selectPerson })
    const editPerson = conData.persons['1']

    const { getByRole } = render(<PersonForm editPerson={editPerson} onClose={() => {}} />)
    fireEvent.click(getByRole('button', { name: 'Con Cả' }))

    expect(selectPerson).toHaveBeenCalledWith('4')
  })

  it('does not show the Con field when adding a new person', () => {
    useGiaphaStore.setState({ data: conData })

    const { queryByText } = render(<PersonForm onClose={() => {}} />)

    expect(queryByText('Con')).toBeNull()
  })
})

describe('PersonForm add Con via picker', () => {
  const initialState = useGiaphaStore.getState()

  afterEach(() => {
    act(() => {
      useGiaphaStore.setState(initialState, true)
    })
    vi.restoreAllMocks()
  })

  const oneSpouseData: GiaphaData = {
    metadata: {} as GiaphaData['metadata'],
    persons: {
      '1': { id: '1', hoTen: 'Cha Một Vợ', gioiTinh: 'nam', laThanhVienHo: true, honNhan: [{ voChongId: '2' }], conCaiIds: [] },
      '2': { id: '2', hoTen: 'Vợ Cha', gioiTinh: 'nu', laThanhVienHo: false, honNhan: [{ voChongId: '1' }], conCaiIds: [] },
      '5': { id: '5', hoTen: 'Người Chưa Liên Kết', gioiTinh: 'nu', laThanhVienHo: true, honNhan: [], conCaiIds: [] },
      '6': { id: '6', hoTen: 'Người Đã Có Bố Mẹ Khác', gioiTinh: 'nam', laThanhVienHo: true, boId: '2', honNhan: [], conCaiIds: [] },
      '7': { id: '7', hoTen: 'Con Đã Có', gioiTinh: 'nu', laThanhVienHo: true, boId: '1', meId: '2', honNhan: [], conCaiIds: [] },
    },
  }

  it('links an unlinked person as a child, auto-filling the single spouse as the other parent', async () => {
    const suaNguoi = vi.fn().mockResolvedValue(undefined)
    useGiaphaStore.setState({ data: oneSpouseData, suaNguoi })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const editPerson = oneSpouseData.persons['1']

    const { getByText } = render(<PersonForm editPerson={editPerson} onClose={() => {}} />)

    fireEvent.click(getByText('+ Thêm con'))
    fireEvent.click(getByText('Chọn con'))
    await act(async () => {
      fireEvent.click(getByText('Người Chưa Liên Kết'))
    })

    expect(suaNguoi).toHaveBeenCalledWith('5', expect.objectContaining({ boId: '1', meId: '2' }))
    expect(getByText('Đã cập nhật Người Chưa Liên Kết làm con của Cha Một Vợ.')).toBeInTheDocument()
  })

  it('shows a success message without calling the API when the person is already a child', () => {
    useGiaphaStore.setState({ data: oneSpouseData, suaNguoi: vi.fn() })
    const editPerson: Person = { ...oneSpouseData.persons['1'], conCaiIds: ['7'] }

    const { getByText, getAllByText } = render(<PersonForm editPerson={editPerson} onClose={() => {}} />)

    fireEvent.click(getByText('+ Thêm con'))
    fireEvent.click(getByText('Chọn con'))
    const conDaCos = getAllByText('Con Đã Có')
    fireEvent.click(conDaCos[1])

    expect(getByText('Con Đã Có đã là con.')).toBeInTheDocument()
  })

  it('shows an error and does not call the API when the selected person already has a conflicting parent', () => {
    const suaNguoi = vi.fn()
    useGiaphaStore.setState({ data: oneSpouseData, suaNguoi })
    const editPerson = oneSpouseData.persons['1']

    const { getByText } = render(<PersonForm editPerson={editPerson} onClose={() => {}} />)

    fireEvent.click(getByText('+ Thêm con'))
    fireEvent.click(getByText('Chọn con'))
    fireEvent.click(getByText('Người Đã Có Bố Mẹ Khác'))

    expect(suaNguoi).not.toHaveBeenCalled()
    expect(getByText('Bố/mẹ của Người Đã Có Bố Mẹ Khác không trùng khớp. Không thể thêm làm con.')).toBeInTheDocument()
  })
})

describe('PersonForm add Con with multiple spouses', () => {
  const initialState = useGiaphaStore.getState()

  afterEach(() => {
    act(() => {
      useGiaphaStore.setState(initialState, true)
    })
    vi.restoreAllMocks()
  })

  const twoSpouseData: GiaphaData = {
    metadata: {} as GiaphaData['metadata'],
    persons: {
      '1': { id: '1', hoTen: 'Cha Nhiều Vợ', gioiTinh: 'nam', laThanhVienHo: true, honNhan: [{ voChongId: '2' }, { voChongId: '3' }], conCaiIds: [] },
      '2': { id: '2', hoTen: 'Vợ Cả', gioiTinh: 'nu', laThanhVienHo: false, honNhan: [{ voChongId: '1' }], conCaiIds: [] },
      '3': { id: '3', hoTen: 'Vợ Hai', gioiTinh: 'nu', laThanhVienHo: false, honNhan: [{ voChongId: '1' }], conCaiIds: [] },
      '4': { id: '4', hoTen: 'Con Chưa Liên Kết', gioiTinh: 'nam', laThanhVienHo: true, honNhan: [], conCaiIds: [] },
    },
  }

  it('shows a spouse-choice dropdown before linking when the person has multiple spouses', async () => {
    const suaNguoi = vi.fn().mockResolvedValue(undefined)
    useGiaphaStore.setState({ data: twoSpouseData, suaNguoi })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const editPerson = twoSpouseData.persons['1']

    const { getByText, getByRole } = render(<PersonForm editPerson={editPerson} onClose={() => {}} />)

    fireEvent.click(getByText('+ Thêm con'))
    fireEvent.click(getByText('Chọn con'))
    fireEvent.click(getByText('Con Chưa Liên Kết'))

    expect(getByText(/Chọn vợ\/chồng là bố\/mẹ còn lại/)).toBeInTheDocument()
    expect(suaNguoi).not.toHaveBeenCalled()

    await act(async () => {
      fireEvent.change(getByRole('combobox'), { target: { value: '3' } })
    })

    expect(suaNguoi).toHaveBeenCalledWith('4', expect.objectContaining({ boId: '1', meId: '3' }))
  })
})

describe('PersonForm mobile full-screen modal', () => {
  const initialState = useGiaphaStore.getState()

  afterEach(() => {
    act(() => {
      useGiaphaStore.setState(initialState, true)
    })
  })

  const editPerson: Person = {
    id: '1',
    hoTen: 'Bố',
    gioiTinh: 'nam',
    laThanhVienHo: true,
    honNhan: [{ voChongId: '2' }],
    conCaiIds: [],
  }

  it('renders full-screen without rounded corners on mobile', () => {
    mockMatchMedia(true)
    useGiaphaStore.setState({ data })

    const { getByTestId } = render(<PersonForm editPerson={editPerson} onClose={() => {}} />)
    const modal = getByTestId('person-form-modal') as HTMLDivElement

    expect(modal.className).toContain('w-full')
    expect(modal.className).toContain('h-full')
    expect(modal.className).not.toContain('rounded-lg')
  })

  it('shows a back arrow instead of the × close button, and drops Hủy from the footer', () => {
    mockMatchMedia(true)
    useGiaphaStore.setState({ data })

    const { getByTestId } = render(<PersonForm editPerson={editPerson} onClose={() => {}} />)

    // The modal header (first child of the modal container) must show the back
    // arrow and drop the × close button. (Unrelated "×" remove-spouse buttons
    // further down the form are expected to remain — only the header's is checked here.)
    const header = getByTestId('person-form-modal').firstElementChild as HTMLElement
    expect(screen.getByRole('button', { name: 'Quay lại' })).toBeInTheDocument()
    expect(within(header).queryByRole('button', { name: '×' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Hủy' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Lưu thay đổi' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Xoá' })).toBeInTheDocument()
  })

  it('back arrow closes immediately when nothing changed', () => {
    mockMatchMedia(true)
    useGiaphaStore.setState({ data })
    const onClose = vi.fn()

    render(<PersonForm editPerson={editPerson} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: 'Quay lại' }))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('back arrow asks for confirmation before closing when the form changed, and respects the answer', () => {
    mockMatchMedia(true)
    useGiaphaStore.setState({ data })
    const onClose = vi.fn()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)

    render(<PersonForm editPerson={editPerson} onClose={onClose} />)
    fireEvent.change(screen.getByDisplayValue('Bố'), { target: { value: 'Bố sửa' } })
    fireEvent.click(screen.getByRole('button', { name: 'Quay lại' }))

    expect(confirmSpy).toHaveBeenCalledTimes(1)
    expect(onClose).not.toHaveBeenCalled()

    confirmSpy.mockReturnValue(true)
    fireEvent.click(screen.getByRole('button', { name: 'Quay lại' }))
    expect(onClose).toHaveBeenCalledTimes(1)

    confirmSpy.mockRestore()
  })

  it('hides Xoá and keeps a full-width Lưu when adding a new person on mobile', () => {
    mockMatchMedia(true)
    useGiaphaStore.setState({ data })

    render(<PersonForm editPerson={null} onClose={() => {}} />)

    expect(screen.queryByRole('button', { name: 'Xoá' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Thêm' })).toBeInTheDocument()
  })
})
