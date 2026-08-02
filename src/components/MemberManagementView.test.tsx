import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MemberManagementView from './MemberManagementView'
import { useGiaphaStore } from '../store/useGiaphaStore'
import { useAuthStore } from '../store/useAuthStore'
import type { GiaphaData } from '../types/giapha'

vi.mock('../services/api', () => ({
  createPerson: vi.fn(),
  updatePerson: vi.fn(),
  deletePerson: vi.fn(),
  getTree: vi.fn(),
}))

import * as api from '../services/api'

const data: GiaphaData = {
  metadata: { tenDongHo: 'Dòng họ mẫu' },
  persons: {
    '1': { id: '1', hoTen: 'Ông Tổ', gioiTinh: 'nam', laThanhVienHo: true, thuTuDoi: 1, honNhan: [], conCaiIds: ['2'] },
    '2': { id: '2', hoTen: 'Con Trai', gioiTinh: 'nam', laThanhVienHo: true, boId: '1', thuTuDoi: 2, honNhan: [], conCaiIds: [] },
  },
}

describe('MemberManagementView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useGiaphaStore.setState({
      data,
      viewMode: 'members',
      selectedPersonId: null,
      focusedPersonId: null,
    })
  })

  it('shows all members in editable table with generation column', () => {
    render(<MemberManagementView />)

    expect(screen.getByText('Quản lý thành viên')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Ông Tổ')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Con Trai')).toBeInTheDocument()
    expect(screen.getByText('Đời')).toBeInTheDocument()
    expect(screen.getByTestId('thuTuDoi-0')).toHaveValue('1')
    expect(screen.getByTestId('thuTuDoi-1')).toHaveValue('2')
    expect(screen.getByText('Ngày sinh')).toBeInTheDocument()
    expect(screen.getByText('Ngày mất')).toBeInTheDocument()
    expect(screen.getByText('Địa chỉ')).toBeInTheDocument()
    expect(screen.getByText('Tiểu sử')).toBeInTheDocument()
    expect(screen.getByTestId('member-table-scroll')).toBeInTheDocument()
  })

  it('hides the ID column from the GUI without affecting underlying row data', () => {
    render(<MemberManagementView />)

    // No 'ID' header column and no id-N input cells rendered.
    expect(screen.queryByText('ID')).not.toBeInTheDocument()
    expect(screen.queryByTestId('sort-header-id')).not.toBeInTheDocument()
    expect(screen.queryByTestId('id-0')).not.toBeInTheDocument()
    expect(screen.queryByTestId('id-1')).not.toBeInTheDocument()

    // Every other column still renders as before.
    expect(screen.getByTestId('sort-header-hoTen')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Ông Tổ')).toBeInTheDocument()
  })

  it('allows adding a new row and applying changes in one action', async () => {
    vi.mocked(api.createPerson).mockResolvedValue({ id: 'new-1' })
    vi.mocked(api.getTree).mockResolvedValue({
      metadata: data.metadata,
      persons: {
        ...data.persons,
        'new-1': { id: 'new-1', hoTen: 'Thành viên mới', gioiTinh: 'nam', laThanhVienHo: true, boId: '1', honNhan: [], conCaiIds: [] },
      },
    })

    const user = userEvent.setup()
    render(<MemberManagementView />)

    await user.click(screen.getByRole('button', { name: 'Thêm dòng mới' }))
    await user.type(screen.getByTestId('hoTen-0'), 'Thành viên mới')
    await user.click(screen.getByRole('button', { name: 'Chọn bố dòng 1' }))
    const modal = (await screen.findByText('Chọn bố')).closest('div.bg-white') as HTMLElement
    await user.click(within(modal).getByText('Ông Tổ'))

    await user.click(screen.getByRole('button', { name: 'Áp dụng thay đổi' }))

    expect(api.createPerson).toHaveBeenCalledWith(expect.objectContaining({ hoTen: 'Thành viên mới', boId: '1' }))
    expect(await screen.findByText(/Đã cập nhật/)).toBeInTheDocument()
  })

  it('allows toggling ngoại tộc and deleting a row', async () => {
    const user = userEvent.setup()
    render(<MemberManagementView />)

    const ngoaiTocCheckbox = screen.getByTestId('laThanhVienHo-1')
    expect(ngoaiTocCheckbox).not.toBeChecked()
    await user.click(ngoaiTocCheckbox)
    expect(ngoaiTocCheckbox).toBeChecked()

    const deleteButton = screen.getByRole('button', { name: 'Xóa thành viên dòng 2' })
    await user.click(deleteButton)
    expect(screen.queryByDisplayValue('Con Trai')).not.toBeInTheDocument()
    expect(api.deletePerson).not.toHaveBeenCalled()
  })

  it('rejects a non-numeric Đời value but still saves other valid rows in the same batch', async () => {
    const user = userEvent.setup()
    render(<MemberManagementView />)

    await user.type(screen.getByTestId('thuTuDoi-1'), 'x')
    await user.type(screen.getByTestId('tieuSu-0'), 'Cập nhật')
    await user.click(screen.getByRole('button', { name: 'Áp dụng thay đổi' }))

    expect(await screen.findByText(/Đời phải là số/)).toBeInTheDocument()
    expect(api.updatePerson).not.toHaveBeenCalledWith('2', expect.anything())
    expect(api.updatePerson).toHaveBeenCalledWith('1', expect.objectContaining({ tieuSu: 'Cập nhật' }))
  })

  it('rejects a decimal or non-finite Đời value', async () => {
    const user = userEvent.setup()
    render(<MemberManagementView />)

    await user.clear(screen.getByTestId('thuTuDoi-1'))
    await user.type(screen.getByTestId('thuTuDoi-1'), '1.5')
    await user.click(screen.getByRole('button', { name: 'Áp dụng thay đổi' }))

    expect(await screen.findByText(/Đời phải là số/)).toBeInTheDocument()
    expect(api.updatePerson).not.toHaveBeenCalledWith('2', expect.anything())
  })

  it('saves a partial lunar birth date entered via the masked date input', async () => {
    const user = userEvent.setup()
    render(<MemberManagementView />)

    const dateInput = screen.getByTestId('namSinh-0-date')
    await user.click(dateInput)
    await user.keyboard('{ArrowRight}{ArrowRight}')
    await user.type(dateInput, '1954')
    await user.click(screen.getByTestId('namSinh-0-amLich'))
    await user.click(screen.getByRole('button', { name: 'Áp dụng thay đổi' }))

    expect(await screen.findByText(/Đã cập nhật/)).toBeInTheDocument()
    expect(api.updatePerson).toHaveBeenCalledWith('1', expect.objectContaining({
      namSinh: { nam: 1954, thang: undefined, ngay: undefined, amLich: true },
    }))
  })

  it('only updates the row that actually changed, skipping untouched rows', async () => {
    vi.mocked(api.getTree).mockResolvedValue(data)
    const user = userEvent.setup()
    render(<MemberManagementView />)

    await user.type(screen.getByTestId('tieuSu-0'), 'Cập nhật')
    await user.click(screen.getByRole('button', { name: 'Áp dụng thay đổi' }))

    expect(await screen.findByText(/Đã cập nhật 1 thành viên, bỏ qua 1 không đổi\./)).toBeInTheDocument()
    expect(api.updatePerson).toHaveBeenCalledTimes(1)
    expect(api.updatePerson).toHaveBeenCalledWith('1', expect.objectContaining({ tieuSu: 'Cập nhật' }))
    expect(api.updatePerson).not.toHaveBeenCalledWith('2', expect.anything())
  })

  it('reloads exactly once per Apply regardless of how many rows were mutated', async () => {
    vi.mocked(api.getTree).mockResolvedValue(data)
    const user = userEvent.setup()
    render(<MemberManagementView />)

    await user.type(screen.getByTestId('tieuSu-0'), 'Cập nhật A')
    await user.type(screen.getByTestId('tieuSu-1'), 'Cập nhật B')
    await user.click(screen.getByRole('button', { name: 'Áp dụng thay đổi' }))

    await screen.findByText(/Đã cập nhật/)
    expect(api.updatePerson).toHaveBeenCalledTimes(2)
    expect(api.getTree).toHaveBeenCalledTimes(1)
  })

  it('marks an edited cell as dirty and leaves untouched cells alone', async () => {
    const user = userEvent.setup()
    render(<MemberManagementView />)

    const tieuSuCell = screen.getByTestId('tieuSu-0')
    const hoTenCell = screen.getByTestId('hoTen-0')
    expect(tieuSuCell.closest('td')).not.toHaveAttribute('data-dirty', 'true')

    await user.type(tieuSuCell, 'Cập nhật')

    expect(tieuSuCell.closest('td')).toHaveAttribute('data-dirty', 'true')
    expect(hoTenCell.closest('td')).not.toHaveAttribute('data-dirty', 'true')
  })

  it('marks a newly added row as new/unsaved', async () => {
    const user = userEvent.setup()
    render(<MemberManagementView />)

    await user.click(screen.getByRole('button', { name: 'Thêm dòng mới' }))
    const newRow = screen.getByTestId('hoTen-0').closest('tr')

    expect(newRow).toHaveClass('bg-emerald-50/60')
  })

  it('clears the dirty highlight after a successful Apply', async () => {
    vi.mocked(api.getTree).mockResolvedValue({
      metadata: data.metadata,
      persons: { ...data.persons, '1': { ...data.persons['1'], tieuSu: 'Cập nhật' } },
    })
    const user = userEvent.setup()
    render(<MemberManagementView />)

    const tieuSuCell = screen.getByTestId('tieuSu-0')
    await user.type(tieuSuCell, 'Cập nhật')
    expect(tieuSuCell.closest('td')).toHaveAttribute('data-dirty', 'true')

    await user.click(screen.getByRole('button', { name: 'Áp dụng thay đổi' }))
    await screen.findByText(/Đã cập nhật/)

    expect(screen.getByTestId('tieuSu-0').closest('td')).not.toHaveAttribute('data-dirty', 'true')
  })

  it('auto-computes Đời for a row with a known parent, staging it without a network call', async () => {
    useGiaphaStore.setState({
      data: {
        metadata: data.metadata,
        persons: { '1': data.persons['1'], '2': { ...data.persons['2'], thuTuDoi: undefined } },
      },
      viewMode: 'members',
      selectedPersonId: null,
      focusedPersonId: null,
    })
    const user = userEvent.setup()
    render(<MemberManagementView />)

    expect(screen.getByTestId('thuTuDoi-1')).toHaveValue('')
    await user.click(screen.getByRole('button', { name: 'Tự động cập nhật' }))

    expect(screen.getByTestId('thuTuDoi-1')).toHaveValue('2')
    expect(screen.getByTestId('thuTuDoi-1').closest('td')).toHaveAttribute('data-dirty', 'true')
    expect(api.createPerson).not.toHaveBeenCalled()
    expect(api.updatePerson).not.toHaveBeenCalled()
    expect(api.deletePerson).not.toHaveBeenCalled()
  })

  it('warns when a member has no resolvable Đời basis', async () => {
    useGiaphaStore.setState({
      data: {
        metadata: data.metadata,
        persons: {
          '3': { id: '3', hoTen: 'Người cô lập', gioiTinh: 'nam', laThanhVienHo: true, honNhan: [], conCaiIds: [] },
        },
      },
      viewMode: 'members',
      selectedPersonId: null,
      focusedPersonId: null,
    })
    const user = userEvent.setup()
    render(<MemberManagementView />)

    await user.click(screen.getByRole('button', { name: 'Tự động cập nhật' }))

    expect(await screen.findByText(/Người cô lập/)).toBeInTheDocument()
  })

  describe('column sorting', () => {
    function getHoTenOrder() {
      return screen.getAllByTestId(/^hoTen-\d+$/).map(el => (el as HTMLInputElement).value)
    }

    it('sorts by a column ascending on first click, descending on second, then clears on third', async () => {
      const user = userEvent.setup()
      render(<MemberManagementView />)

      // Default order: Ông Tổ (row 0), Con Trai (row 1)
      expect(getHoTenOrder()).toEqual(['Ông Tổ', 'Con Trai'])

      const hoTenHeader = screen.getByTestId('sort-header-hoTen')

      await user.click(hoTenHeader)
      expect(hoTenHeader).toHaveAttribute('aria-sort', 'ascending')
      expect(getHoTenOrder()).toEqual(['Con Trai', 'Ông Tổ'])

      await user.click(hoTenHeader)
      expect(hoTenHeader).toHaveAttribute('aria-sort', 'descending')
      expect(getHoTenOrder()).toEqual(['Ông Tổ', 'Con Trai'])

      await user.click(hoTenHeader)
      expect(hoTenHeader).toHaveAttribute('aria-sort', 'none')
      expect(getHoTenOrder()).toEqual(['Ông Tổ', 'Con Trai'])
    })

    it('does not attach sort behavior to the non-sortable voChongIds column', () => {
      render(<MemberManagementView />)
      expect(screen.queryByTestId('sort-header-voChongIds')).not.toHaveAttribute('aria-sort')
    })

    it('keeps edits and deletes targeting the correct underlying row after sorting', async () => {
      const user = userEvent.setup()
      render(<MemberManagementView />)

      await user.click(screen.getByTestId('sort-header-hoTen')) // ASC: Con Trai now displayed first

      // hoTen-1 always refers to 'Con Trai' (its real position in the underlying rows array)
      // regardless of display order.
      const conTraiInput = screen.getByTestId('hoTen-1')
      const conTraiRow = conTraiInput.closest('tr')
      expect(conTraiRow).not.toBeNull()
      const deleteButton = within(conTraiRow as HTMLElement).getByRole('button', { name: /Xóa thành viên/ })
      await user.click(deleteButton)

      expect(screen.queryByDisplayValue('Con Trai')).not.toBeInTheDocument()
      expect(screen.getByDisplayValue('Ông Tổ')).toBeInTheDocument()
    })
  })
})

describe('MemberManagementView — editor pending-request flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useGiaphaStore.setState({
      data,
      viewMode: 'members',
      selectedPersonId: null,
      focusedPersonId: null,
    })
    useAuthStore.setState({ user: { id: 'editor-1', username: 'ed1', email: 'e@example.com', role: 'editor', personId: null } })
  })

  it('shows a "sent for approval" message when api.createPerson returns pending:true', async () => {
    vi.mocked(api.createPerson).mockResolvedValue({ pending: true, requestId: 'req-1' })
    vi.mocked(api.getTree).mockResolvedValue(data)

    const user = userEvent.setup()
    render(<MemberManagementView />)

    await user.click(screen.getByRole('button', { name: 'Thêm dòng mới' }))
    await user.type(screen.getByTestId('hoTen-0'), 'Thành viên mới')
    await user.click(screen.getByRole('button', { name: 'Áp dụng thay đổi' }))

    expect(await screen.findByText(/Đã gửi 1 thay đổi để chờ admin duyệt/)).toBeInTheDocument()
  })
})
