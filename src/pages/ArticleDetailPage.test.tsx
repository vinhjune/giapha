import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import ArticleDetailPage from './ArticleDetailPage'
import * as api from '../services/api'

vi.mock('../services/api')

const sampleArticle = {
  id: 'art-1',
  slug: 'tu-mai-nha-chung',
  categoryId: 'cat-1',
  title: 'Từ mái nhà chung',
  summary: 'Câu chuyện mở đầu của dòng họ.',
  body: 'Đoạn văn thứ nhất.\n\nĐoạn văn thứ hai.',
  coverImageKey: 'article-covers/art-1.jpg',
  status: 'published' as const,
  displayOrder: 1,
  publishedAt: '2026-08-02T00:00:00.000Z',
  authorId: 'u1',
  createdAt: '2026-08-02T00:00:00.000Z',
  updatedAt: '2026-08-02T00:00:00.000Z',
}

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/bai-viet/:slug" element={<ArticleDetailPage />} />
        <Route path="/" element={<div>HomePage stub</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ArticleDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetches the article by slug from the route param and renders its full content', async () => {
    vi.mocked(api.getArticleBySlug).mockResolvedValue(sampleArticle)

    renderAt('/bai-viet/tu-mai-nha-chung')

    await waitFor(() => expect(screen.getByText('Từ mái nhà chung')).toBeInTheDocument())

    expect(api.getArticleBySlug).toHaveBeenCalledWith('tu-mai-nha-chung')
    expect(screen.getByText('Câu chuyện mở đầu của dòng họ.')).toBeInTheDocument()
    expect(screen.getByText('Đoạn văn thứ nhất.')).toBeInTheDocument()
    expect(screen.getByText('Đoạn văn thứ hai.')).toBeInTheDocument()
    expect(document.querySelector('img[src="/api/avatars/article-covers/art-1.jpg"]')).not.toBeNull()
  })

  it('shows a not-found message with a link back home when the article does not exist', async () => {
    vi.mocked(api.getArticleBySlug).mockRejectedValue(new Error('Không tìm thấy bài viết'))

    renderAt('/bai-viet/khong-ton-tai')

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())

    expect(screen.getByRole('alert')).toHaveTextContent('Không tìm thấy bài viết')
    expect(screen.getByRole('link', { name: /về trang chủ/i })).toHaveAttribute('href', '/')
  })
})
