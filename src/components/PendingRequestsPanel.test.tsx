import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import PendingRequestsPanel from './PendingRequestsPanel'
import { useAuthStore } from '../store/useAuthStore'
import * as api from '../services/api'

vi.mock('../services/api')

const sampleRequest = {
  id: 'req-1', type: 'create' as const, personId: null,
  payload: JSON.stringify({ hoTen: 'Nguyễn Văn A' }), submittedBy: 'editor-1',
  status: 'pending' as const, resolvedBy: null, resolvedAt: null, createdAt: '2024-01-01T00:00:00.000Z',
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(api.listRequests).mockResolvedValue({ requests: [sampleRequest] })
})

describe('PendingRequestsPanel (admin)', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: { id: 'admin-1', username: 'admin1', email: 'a@example.com', role: 'admin', personId: null } })
  })

  it('lists requests and shows a readable summary', async () => {
    render(<PendingRequestsPanel />)
    await waitFor(() => expect(screen.getByText(/Nguyễn Văn A/)).toBeInTheDocument())
    expect(screen.getByText(/Thêm mới/)).toBeInTheDocument()
  })

  it('approves a request and refreshes the list', async () => {
    vi.mocked(api.approveRequest).mockResolvedValue({ ok: true })
    render(<PendingRequestsPanel />)
    await waitFor(() => screen.getByText('Duyệt'))
    fireEvent.click(screen.getByText('Duyệt'))
    await waitFor(() => expect(api.approveRequest).toHaveBeenCalledWith('req-1'))
    await waitFor(() => expect(api.listRequests).toHaveBeenCalledTimes(2))
  })

  it('rejects a request and refreshes the list', async () => {
    vi.mocked(api.rejectRequest).mockResolvedValue({ ok: true })
    render(<PendingRequestsPanel />)
    await waitFor(() => screen.getByText('Từ chối'))
    fireEvent.click(screen.getByText('Từ chối'))
    await waitFor(() => expect(api.rejectRequest).toHaveBeenCalledWith('req-1'))
  })
})

describe('PendingRequestsPanel (editor)', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: { id: 'editor-1', username: 'ed1', email: 'e@example.com', role: 'editor', personId: null } })
  })

  it('does not show Approve/Reject buttons', async () => {
    render(<PendingRequestsPanel />)
    await waitFor(() => expect(screen.getByText(/Nguyễn Văn A/)).toBeInTheDocument())
    expect(screen.queryByText('Duyệt')).not.toBeInTheDocument()
    expect(screen.queryByText('Từ chối')).not.toBeInTheDocument()
  })
})
