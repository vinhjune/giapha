import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import CsvPanel from './CsvPanel'
import * as api from '../services/api'
import { useGiaphaStore } from '../store/useGiaphaStore'

vi.mock('../services/api')

beforeEach(() => {
  vi.clearAllMocks()
  useGiaphaStore.setState({ data: { metadata: { tenDongHo: 'Họ Test' }, persons: {} } })
})

describe('CsvPanel', () => {
  it('exports CSV when the export button is clicked', async () => {
    const blob = new Blob(['id,name'], { type: 'text/csv' })
    vi.mocked(api.exportCsv).mockResolvedValue(blob)
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:mock'), revokeObjectURL: vi.fn() })
    render(<CsvPanel />)
    fireEvent.click(screen.getByText('Xuất CSV'))
    await waitFor(() => expect(api.exportCsv).toHaveBeenCalled())
  })

  it('imports a CSV file and shows the result summary', async () => {
    vi.mocked(api.importCsv).mockResolvedValue({ imported: { persons: 3, families: 1 } })
    render(<CsvPanel />)
    const file = new File(['id,name\n1,A'], 'test.csv', { type: 'text/csv' })
    const input = screen.getByLabelText('Chọn file CSV để nhập') as HTMLInputElement
    fireEvent.change(input, { target: { files: [file] } })
    await waitFor(() => expect(screen.getByText(/Đã nhập/)).toBeInTheDocument())
    expect(screen.getByText(/3/)).toBeInTheDocument()
  })

  it('shows an error message when import fails', async () => {
    vi.mocked(api.importCsv).mockRejectedValue(new Error('Sai định dạng'))
    render(<CsvPanel />)
    const file = new File(['bad'], 'test.csv', { type: 'text/csv' })
    const input = screen.getByLabelText('Chọn file CSV để nhập') as HTMLInputElement
    fireEvent.change(input, { target: { files: [file] } })
    await waitFor(() => expect(screen.getByText('Sai định dạng')).toBeInTheDocument())
  })
})
