import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ArticleManagementView from './ArticleManagementView'
import * as api from '../services/api'

vi.mock('../services/api')

const sampleCategories = [
  {
    id: 'cat-1',
    slug: 'gioi-thieu',
    name: 'Giới thiệu dòng họ',
    displayOrder: 1,
    articleCount: 2,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'cat-2',
    slug: 'tin-tuc',
    name: 'Tin tức',
    displayOrder: 2,
    articleCount: 0,
    createdAt: '2024-01-02T00:00:00.000Z',
    updatedAt: '2024-01-02T00:00:00.000Z',
  },
]

const sampleArticles = [
  {
    id: 'art-1',
    slug: 've-nguon',
    categoryId: 'cat-1',
    title: 'Về nguồn',
    summary: 'Tóm tắt bài viết về nguồn',
    body: 'Nội dung bài viết về nguồn',
    coverImageKey: null,
    status: 'published' as const,
    displayOrder: 1,
    publishedAt: '2024-01-03T00:00:00.000Z',
    authorId: 'u1',
    createdAt: '2024-01-03T00:00:00.000Z',
    updatedAt: '2024-01-03T00:00:00.000Z',
  },
  {
    id: 'art-2',
    slug: 'ban-thao',
    categoryId: 'cat-2',
    title: 'Bản thảo mới',
    summary: 'Tóm tắt bản thảo',
    body: 'Nội dung bản thảo',
    coverImageKey: null,
    status: 'draft' as const,
    displayOrder: 2,
    publishedAt: null,
    authorId: 'u1',
    createdAt: '2024-01-04T00:00:00.000Z',
    updatedAt: '2024-01-04T00:00:00.000Z',
  },
]

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(api.listAllArticles).mockResolvedValue(sampleArticles)
  vi.mocked(api.listArticleCategories).mockResolvedValue(sampleCategories)
})

describe('ArticleManagementView', () => {
  it('renders the list of articles with resolved category names', async () => {
    render(<ArticleManagementView />)

    await waitFor(() => expect(screen.getByText('Về nguồn')).toBeInTheDocument())
    expect(screen.getByText('Giới thiệu dòng họ')).toBeInTheDocument()
    expect(screen.getByText('Tin tức')).toBeInTheDocument()
    expect(screen.getByText('Đã đăng')).toBeInTheDocument()
    expect(screen.getByText('Nháp')).toBeInTheDocument()
  })

  it('renders categories with article counts once the category panel is opened', async () => {
    render(<ArticleManagementView />)

    await waitFor(() => screen.getByText('Về nguồn'))
    fireEvent.click(screen.getByText('Quản lý chuyên mục'))

    expect(screen.getByText('Giới thiệu dòng họ (2)')).toBeInTheDocument()
    expect(screen.getByText('Tin tức (0)')).toBeInTheDocument()
  })

  it('creates a new article via the form', async () => {
    vi.mocked(api.createArticle).mockResolvedValue({
      id: 'art-3',
      slug: 'lich-su-ho',
      categoryId: 'cat-1',
      title: 'Lịch sử họ',
      summary: 'Tóm tắt lịch sử họ',
      body: 'Nội dung lịch sử họ',
      coverImageKey: null,
      status: 'draft',
      displayOrder: 3,
      publishedAt: null,
      authorId: 'u1',
      createdAt: '2024-01-05T00:00:00.000Z',
      updatedAt: '2024-01-05T00:00:00.000Z',
    })

    render(<ArticleManagementView />)
    await waitFor(() => screen.getByText('Về nguồn'))

    fireEvent.click(screen.getByText('Thêm bài viết'))
    fireEvent.change(screen.getByLabelText('Tiêu đề'), { target: { value: 'Lịch sử họ' } })
    fireEvent.change(screen.getByLabelText('Slug'), { target: { value: 'lich-su-ho' } })
    fireEvent.change(screen.getByLabelText('Chuyên mục'), { target: { value: 'cat-1' } })
    fireEvent.change(screen.getByLabelText('Tóm tắt'), { target: { value: 'Tóm tắt lịch sử họ' } })
    fireEvent.change(screen.getByLabelText('Nội dung'), { target: { value: 'Nội dung lịch sử họ' } })
    fireEvent.change(screen.getByLabelText('Trạng thái'), { target: { value: 'draft' } })
    fireEvent.click(screen.getByRole('button', { name: 'Tạo' }))

    await waitFor(() => expect(api.createArticle).toHaveBeenCalledWith({
      title: 'Lịch sử họ',
      slug: 'lich-su-ho',
      categoryId: 'cat-1',
      summary: 'Tóm tắt lịch sử họ',
      body: 'Nội dung lịch sử họ',
      status: 'draft',
    }))
  })

  it('creates a new category via the inline category form', async () => {
    vi.mocked(api.createArticleCategory).mockResolvedValue({
      id: 'cat-3',
      slug: 'tu-lieu',
      name: 'Tư liệu',
      displayOrder: 3,
      articleCount: 0,
      createdAt: '2024-01-06T00:00:00.000Z',
      updatedAt: '2024-01-06T00:00:00.000Z',
    })

    render(<ArticleManagementView />)
    await waitFor(() => screen.getByText('Về nguồn'))

    fireEvent.click(screen.getByText('Quản lý chuyên mục'))
    fireEvent.change(screen.getByLabelText('Slug chuyên mục'), { target: { value: 'tu-lieu' } })
    fireEvent.change(screen.getByLabelText('Tên chuyên mục'), { target: { value: 'Tư liệu' } })
    fireEvent.click(screen.getByRole('button', { name: 'Thêm chuyên mục' }))

    await waitFor(() => expect(api.createArticleCategory).toHaveBeenCalledWith({
      slug: 'tu-lieu',
      name: 'Tư liệu',
    }))
  })

  it('deletes an article', async () => {
    vi.mocked(api.deleteArticle).mockResolvedValue()

    render(<ArticleManagementView />)
    await waitFor(() => screen.getByText('Bản thảo mới'))

    fireEvent.click(screen.getByLabelText('Xóa bài viết Bản thảo mới'))

    await waitFor(() => expect(api.deleteArticle).toHaveBeenCalledWith('art-2'))
  })

  it('shows the backend error when deleting a category that still has articles', async () => {
    vi.mocked(api.deleteArticleCategory).mockRejectedValue(new Error('Chuyên mục vẫn còn bài viết'))

    render(<ArticleManagementView />)
    await waitFor(() => screen.getByText('Về nguồn'))

    fireEvent.click(screen.getByText('Quản lý chuyên mục'))
    fireEvent.click(screen.getByLabelText('Xóa chuyên mục Giới thiệu dòng họ'))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Chuyên mục vẫn còn bài viết'))
  })

  it('shows loading state as a status message while fetching data', () => {
    vi.mocked(api.listAllArticles).mockImplementation(() => new Promise(() => undefined))
    vi.mocked(api.listArticleCategories).mockImplementation(() => new Promise(() => undefined))

    render(<ArticleManagementView />)

    expect(screen.getByRole('status')).toHaveTextContent('Đang tải…')
  })

  it('falls back to the first remaining category after deleting the selected one in the create form', async () => {
    vi.mocked(api.deleteArticleCategory).mockResolvedValue()
    vi.mocked(api.createArticle).mockResolvedValue({
      id: 'art-3',
      slug: 'sau-khi-xoa',
      categoryId: 'cat-1',
      title: 'Sau khi xóa',
      summary: 'Tóm tắt sau khi xóa',
      body: 'Nội dung sau khi xóa',
      coverImageKey: null,
      status: 'draft',
      displayOrder: 3,
      publishedAt: null,
      authorId: 'u1',
      createdAt: '2024-01-07T00:00:00.000Z',
      updatedAt: '2024-01-07T00:00:00.000Z',
    })
    vi.mocked(api.listArticleCategories)
      .mockResolvedValueOnce(sampleCategories)
      .mockResolvedValueOnce([sampleCategories[0]])

    render(<ArticleManagementView />)
    await waitFor(() => screen.getByText('Về nguồn'))

    fireEvent.click(screen.getByText('Thêm bài viết'))
    fireEvent.change(screen.getByLabelText('Chuyên mục'), { target: { value: 'cat-2' } })

    fireEvent.click(screen.getByText('Quản lý chuyên mục'))
    fireEvent.click(screen.getByLabelText('Xóa chuyên mục Tin tức'))

    await waitFor(() => expect(api.deleteArticleCategory).toHaveBeenCalledWith('cat-2'))

    fireEvent.change(screen.getByLabelText('Tiêu đề'), { target: { value: 'Sau khi xóa' } })
    fireEvent.change(screen.getByLabelText('Slug'), { target: { value: 'sau-khi-xoa' } })
    fireEvent.change(screen.getByLabelText('Tóm tắt'), { target: { value: 'Tóm tắt sau khi xóa' } })
    fireEvent.change(screen.getByLabelText('Nội dung'), { target: { value: 'Nội dung sau khi xóa' } })
    fireEvent.click(screen.getByRole('button', { name: 'Tạo' }))

    await waitFor(() => expect(api.createArticle).toHaveBeenCalledWith({
      title: 'Sau khi xóa',
      slug: 'sau-khi-xoa',
      categoryId: 'cat-1',
      summary: 'Tóm tắt sau khi xóa',
      body: 'Nội dung sau khi xóa',
      status: 'draft',
    }))
  })
})
