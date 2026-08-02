import { render, screen } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import ControlPanelPage from './ControlPanelPage'
import { useAuthStore } from '../store/useAuthStore'

vi.mock('../components/MemberManagementView', () => ({ default: () => <div>MemberManagementView stub</div> }))
vi.mock('../components/PendingRequestsPanel', () => ({ default: () => <div>PendingRequestsPanel stub</div> }))
vi.mock('../components/CsvPanel', () => ({ default: () => <div>CsvPanel stub</div> }))
vi.mock('../components/UserManagementPanel', () => ({ default: () => <div>UserManagementPanel stub</div> }))

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/control-panel" element={<ControlPanelPage />} />
        <Route path="/" element={<div>HomePage stub</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  useAuthStore.setState({ user: null, setupNeeded: false, loading: false, error: null })
})

describe('ControlPanelPage', () => {
  it('redirects to / when there is no logged-in user', () => {
    renderAt('/control-panel')
    expect(screen.getByText('HomePage stub')).toBeInTheDocument()
  })

  it('editor sees Thành viên and Yêu cầu của tôi tabs only', () => {
    useAuthStore.setState({ user: { id: '1', username: 'ed1', email: 'e@example.com', role: 'editor', personId: null } })
    renderAt('/control-panel')
    expect(screen.getByText('Thành viên')).toBeInTheDocument()
    expect(screen.getByText('Yêu cầu của tôi')).toBeInTheDocument()
    expect(screen.queryByText('CSV')).not.toBeInTheDocument()
    expect(screen.queryByText('Quản lý User')).not.toBeInTheDocument()
  })

  it('admin sees all tabs including CSV and Quản lý User', () => {
    useAuthStore.setState({ user: { id: '2', username: 'admin1', email: 'a@example.com', role: 'admin', personId: null } })
    renderAt('/control-panel')
    expect(screen.getByText('Thành viên')).toBeInTheDocument()
    expect(screen.getByText('Yêu cầu chờ duyệt')).toBeInTheDocument()
    expect(screen.getByText('CSV')).toBeInTheDocument()
    expect(screen.getByText('Quản lý User')).toBeInTheDocument()
  })
})
