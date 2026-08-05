import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import RichTextEditor from './RichTextEditor'
import * as api from '../services/api'

vi.mock('../services/api')

describe('RichTextEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the initial HTML content', async () => {
    render(<RichTextEditor value="<p>Xin chào</p>" onChange={vi.fn()} ariaLabel="Nội dung" />)

    await waitFor(() => expect(screen.getByText('Xin chào')).toBeInTheDocument())
  })

  it('renders a formatting toolbar with the expected buttons', async () => {
    render(<RichTextEditor value="<p>Nội dung</p>" onChange={vi.fn()} ariaLabel="Nội dung" />)

    await waitFor(() => expect(screen.getByRole('toolbar')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Đậm' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Nghiêng' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Chèn ảnh' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Chèn liên kết' })).toBeInTheDocument()
  })

  it('uploads a picked image and inserts it into the document', async () => {
    vi.mocked(api.uploadArticleImage).mockResolvedValue({ url: '/api/avatars/article-content/abc.jpg' })

    render(<RichTextEditor value="<p></p>" onChange={vi.fn()} ariaLabel="Nội dung" />)
    await waitFor(() => expect(screen.getByRole('toolbar')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: 'Chèn ảnh' }))

    const file = new File(['fake-image-bytes'], 'photo.jpg', { type: 'image/jpeg' })
    const fileInput = screen.getByLabelText('Chọn ảnh để chèn vào nội dung') as HTMLInputElement
    fireEvent.change(fileInput, { target: { files: [file] } })

    await waitFor(() => expect(api.uploadArticleImage).toHaveBeenCalledWith(file))
    await waitFor(() => expect(document.querySelector('img[src="/api/avatars/article-content/abc.jpg"]')).toBeInTheDocument())
  })
})
