import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import LandingPage from './LandingPage'
import * as api from '../services/api'

vi.mock('../services/api')

const sampleCategories = [
  {
    id: 'cat-1',
    slug: 'gioi-thieu',
    name: 'Giới thiệu dòng họ',
    displayOrder: 1,
    articleCount: 0,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  },
  {
    id: 'cat-2',
    slug: 'su-kien',
    name: 'Sự kiện',
    displayOrder: 2,
    articleCount: 0,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  },
]

const sampleArticles = [
  {
    id: 'art-1',
    slug: 'tu-mai-nha-chung',
    categoryId: 'cat-1',
    title: 'Từ mái nhà chung',
    summary: 'Câu chuyện mở đầu của dòng họ.',
    body: 'Nội dung bài viết mở đầu.',
    coverImageKey: 'article-covers/art-1.jpg',
    status: 'published' as const,
    displayOrder: 1,
    publishedAt: '2026-08-02T00:00:00.000Z',
    authorId: 'u1',
    createdAt: '2026-08-02T00:00:00.000Z',
    updatedAt: '2026-08-02T00:00:00.000Z',
  },
  {
    id: 'art-2',
    slug: 'gia-pha-giay',
    categoryId: 'cat-1',
    title: 'Gia phả giấy còn lưu lại',
    summary: 'Tư liệu viết tay được gìn giữ qua nhiều đời.',
    body: 'Nội dung bài viết gia phả giấy.',
    coverImageKey: null,
    status: 'published' as const,
    displayOrder: 2,
    publishedAt: '2026-08-03T00:00:00.000Z',
    authorId: 'u1',
    createdAt: '2026-08-03T00:00:00.000Z',
    updatedAt: '2026-08-03T00:00:00.000Z',
  },
  {
    id: 'art-3',
    slug: 'ngay-gio-to',
    categoryId: 'cat-2',
    title: 'Ngày giỗ tổ năm nay',
    summary: 'Nhắc lịch sum họp đầu thu.',
    body: 'Nội dung bài viết sự kiện.',
    coverImageKey: null,
    status: 'published' as const,
    displayOrder: 1,
    publishedAt: '2026-08-04T00:00:00.000Z',
    authorId: 'u1',
    createdAt: '2026-08-04T00:00:00.000Z',
    updatedAt: '2026-08-04T00:00:00.000Z',
  },
]

const sampleEvents = [
  {
    id: 'event-1',
    title: 'Lễ giỗ tổ',
    description: 'Tập trung tại nhà thờ họ.',
    dateText: null,
    year: 2099,
    month: 8,
    day: 20,
    isLunar: false,
    isRecurring: false,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  },
  {
    id: 'event-2',
    title: 'Họp mặt đầu năm',
    description: 'Sự kiện đã qua.',
    dateText: null,
    year: 2000,
    month: 1,
    day: 15,
    isLunar: false,
    isRecurring: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
]

async function renderPage() {
  render(
    <MemoryRouter>
      <LandingPage />
    </MemoryRouter>,
  )
}

async function renderPageAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/bai-viet/:slug" element={<LandingPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('LandingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(api.listArticleCategories).mockResolvedValue(sampleCategories)
    vi.mocked(api.listArticles).mockResolvedValue(sampleArticles)
    vi.mocked(api.listEvents).mockResolvedValue(sampleEvents)
  })

  it('renders fetched categories with counts and articles', async () => {
    await renderPage()

    await waitFor(() => expect(screen.getByText('Từ mái nhà chung')).toBeInTheDocument())

    expect(screen.getAllByRole('link', { name: /giới thiệu dòng họ/i }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: /sự kiện/i }).length).toBeGreaterThan(0)
    expect(screen.getAllByText('2').length).toBeGreaterThan(0)
    expect(screen.getAllByText('1').length).toBeGreaterThan(0)
    expect(screen.getByText('Gia phả giấy còn lưu lại')).toBeInTheDocument()
    expect(screen.getByText('Ngày giỗ tổ năm nay')).toBeInTheDocument()
  })

  it('renders the featured article cover image when present', async () => {
    await renderPage()

    await waitFor(() => expect(screen.getByText('Từ mái nhà chung')).toBeInTheDocument())

    const img = document.querySelector('img[src="/api/avatars/article-covers/art-1.jpg"]')
    expect(img).not.toBeNull()
  })

  it('links each article title to its detail page by slug', async () => {
    await renderPage()

    await waitFor(() => expect(screen.getByText('Từ mái nhà chung')).toBeInTheDocument())

    expect(screen.getByText('Từ mái nhà chung').closest('a')).toHaveAttribute('href', '/bai-viet/tu-mai-nha-chung')
    expect(screen.getByText('Gia phả giấy còn lưu lại').closest('a')).toHaveAttribute('href', '/bai-viet/gia-pha-giay')
    expect(screen.getByText('Ngày giỗ tổ năm nay').closest('a')).toHaveAttribute('href', '/bai-viet/ngay-gio-to')
  })

  it('renders the xem gia phả link to /gia-pha', async () => {
    await renderPage()

    const links = await screen.findAllByRole('link', { name: /xem gia phả/i })

    expect(links.length).toBeGreaterThan(0)
    expect(links[0]).toHaveAttribute('href', '/gia-pha')
  })

  it('renders the nearest upcoming event when events exist', async () => {
    await renderPage()

    const eventNote = await screen.findByTestId('nearest-event')

    expect(within(eventNote).getByText('Lễ giỗ tổ')).toBeInTheDocument()
    expect(within(eventNote).getByText('Tháng 8')).toBeInTheDocument()
    expect(within(eventNote).getByText('20')).toBeInTheDocument()
    expect(screen.queryByText('Họp mặt đầu năm')).not.toBeInTheDocument()
  })

  it('shows a friendly empty state when there are zero articles', async () => {
    vi.mocked(api.listArticles).mockResolvedValue([])

    await renderPage()

    await waitFor(() => expect(screen.getByText('Chưa có bài viết nào.')).toBeInTheDocument())
  })

  it('handles a fetch failure gracefully', async () => {
    vi.mocked(api.listEvents).mockRejectedValue(new Error('Mạng không ổn định'))

    await renderPage()

    await waitFor(() => expect(screen.getByText('Lỗi tải dữ liệu: Mạng không ổn định')).toBeInTheDocument())
  })

  it('renders the article content inline within the feed section when navigating to /bai-viet/:slug, keeping the header and sidebar mounted', async () => {
    await renderPageAt('/bai-viet/tu-mai-nha-chung')

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Từ mái nhà chung' })).toBeInTheDocument())

    // Header/masthead/sidebar remain visible.
    expect(screen.getByLabelText('Trang chủ Sử nhà dòng họ')).toBeInTheDocument()
    expect(screen.getByLabelText('Điều hướng chuyên mục')).toBeInTheDocument()

    // Full body content is rendered in place of the normal article list, inside the lp-feed section.
    const feedSection = screen.getByLabelText('Dòng bài viết')
    expect(within(feedSection).getByText('Câu chuyện mở đầu của dòng họ.')).toBeInTheDocument()
    expect(within(feedSection).getByText('Nội dung bài viết mở đầu.')).toBeInTheDocument()
    expect(within(feedSection).getByRole('link', { name: /quay lại/i })).toHaveAttribute('href', '/')

    // The normal article list is no longer shown.
    expect(screen.queryByText('Gia phả giấy còn lưu lại')).not.toBeInTheDocument()
  })

  it('shows an inline not-found state when the slug does not match a published article', async () => {
    await renderPageAt('/bai-viet/khong-ton-tai')

    await waitFor(() => expect(screen.getByText('Không tìm thấy bài viết này.')).toBeInTheDocument())

    expect(screen.getByLabelText('Trang chủ Sử nhà dòng họ')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /quay lại trang chủ/i })).toHaveAttribute('href', '/')
  })
})
