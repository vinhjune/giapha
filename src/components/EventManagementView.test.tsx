import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import EventManagementView from './EventManagementView'
import * as api from '../services/api'

vi.mock('../services/api')

const sampleEvents = [
  {
    id: 'event-1',
    title: 'Giỗ tổ',
    description: 'Lễ tưởng niệm tổ tiên',
    dateText: 'Mùng 10 tháng Ba',
    year: null,
    month: null,
    day: null,
    isLunar: true,
    isRecurring: true,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'event-2',
    title: 'Họp mặt đầu năm',
    description: null,
    dateText: null,
    year: 2025,
    month: 2,
    day: 15,
    isLunar: false,
    isRecurring: false,
    createdAt: '2024-01-02T00:00:00.000Z',
    updatedAt: '2024-01-02T00:00:00.000Z',
  },
]

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(api.listEvents).mockResolvedValue(sampleEvents)
})

describe('EventManagementView', () => {
  it('renders the list of events', async () => {
    render(<EventManagementView />)

    await waitFor(() => expect(screen.getByText('Giỗ tổ')).toBeInTheDocument())
    expect(screen.getByText('Lễ tưởng niệm tổ tiên')).toBeInTheDocument()
    expect(screen.getByText(/Mùng 10 tháng Ba/)).toBeInTheDocument()
    expect(screen.getByText(/\(Âm lịch\)/)).toBeInTheDocument()
    expect(screen.getByText(/\(Hàng năm\)/)).toBeInTheDocument()
    expect(screen.getByText('15/2/2025')).toBeInTheDocument()
  })

  it('creates a new event via the form', async () => {
    vi.mocked(api.createEvent).mockResolvedValue({
      id: 'event-3',
      title: 'Tảo mộ',
      description: 'Dọn dẹp phần mộ tổ tiên',
      dateText: null,
      year: 2025,
      month: 3,
      day: 30,
      isLunar: false,
      isRecurring: false,
      createdAt: '2024-01-03T00:00:00.000Z',
      updatedAt: '2024-01-03T00:00:00.000Z',
    })

    render(<EventManagementView />)
    await waitFor(() => screen.getByText('Giỗ tổ'))

    fireEvent.click(screen.getByText('Thêm sự kiện'))
    fireEvent.change(screen.getByLabelText('Tiêu đề'), { target: { value: 'Tảo mộ' } })
    fireEvent.change(screen.getByLabelText('Mô tả'), { target: { value: 'Dọn dẹp phần mộ tổ tiên' } })
    fireEvent.change(screen.getByLabelText('Năm'), { target: { value: '2025' } })
    fireEvent.change(screen.getByLabelText('Tháng'), { target: { value: '3' } })
    fireEvent.change(screen.getByLabelText('Ngày số'), { target: { value: '30' } })
    fireEvent.click(screen.getByRole('button', { name: 'Tạo' }))

    await waitFor(() => expect(api.createEvent).toHaveBeenCalledWith({
      title: 'Tảo mộ',
      description: 'Dọn dẹp phần mộ tổ tiên',
      year: 2025,
      month: 3,
      day: 30,
      isLunar: false,
      isRecurring: false,
    }))
  })

  it('edits an event in place', async () => {
    vi.mocked(api.updateEvent).mockResolvedValue({
      ...sampleEvents[0],
      title: 'Giỗ tổ họ Nguyễn',
      description: 'Nghi lễ chính của dòng họ',
      dateText: 'Rằm tháng Giêng',
      isLunar: false,
      isRecurring: false,
    })

    render(<EventManagementView />)
    await waitFor(() => screen.getByText('Giỗ tổ'))

    fireEvent.click(screen.getAllByText('Sửa')[0])
    fireEvent.change(screen.getByLabelText('Tiêu đề'), { target: { value: 'Giỗ tổ họ Nguyễn' } })
    fireEvent.change(screen.getByLabelText('Mô tả'), { target: { value: 'Nghi lễ chính của dòng họ' } })
    fireEvent.change(screen.getByLabelText('Ngày'), { target: { value: 'Rằm tháng Giêng' } })
    fireEvent.click(screen.getByLabelText('Âm lịch'))
    fireEvent.click(screen.getByLabelText('Lặp lại hàng năm'))
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }))

    await waitFor(() =>
      expect(api.updateEvent).toHaveBeenCalledWith(
        'event-1',
        expect.objectContaining({
          title: 'Giỗ tổ họ Nguyễn',
          description: 'Nghi lễ chính của dòng họ',
          dateText: 'Rằm tháng Giêng',
          isLunar: false,
          isRecurring: false,
        }),
      ),
    )
  })

  it('deletes an event', async () => {
    vi.mocked(api.deleteEvent).mockResolvedValue()

    render(<EventManagementView />)
    await waitFor(() => screen.getByText('Họp mặt đầu năm'))

    fireEvent.click(screen.getByLabelText('Xóa sự kiện Họp mặt đầu năm'))

    await waitFor(() => expect(api.deleteEvent).toHaveBeenCalledWith('event-2'))
  })

  it('shows the backend error message if creation fails', async () => {
    vi.mocked(api.createEvent).mockRejectedValue(new Error('Tiêu đề sự kiện đã tồn tại'))

    render(<EventManagementView />)
    await waitFor(() => screen.getByText('Giỗ tổ'))

    fireEvent.click(screen.getByText('Thêm sự kiện'))
    fireEvent.change(screen.getByLabelText('Tiêu đề'), { target: { value: 'Giỗ tổ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Tạo' }))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Tiêu đề sự kiện đã tồn tại'))
  })
})
