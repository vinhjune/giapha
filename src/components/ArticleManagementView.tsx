import { useEffect, useState } from 'react'
import * as api from '../services/api'
import type { Article, ArticleCategory } from '../types/giapha'

type ArticleStatus = 'draft' | 'published'

function getStatusLabel(status: ArticleStatus) {
  return status === 'published' ? 'Đã đăng' : 'Nháp'
}

export default function ArticleManagementView() {
  const [articles, setArticles] = useState<Article[]>([])
  const [categories, setCategories] = useState<ArticleCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [categoryPanelOpen, setCategoryPanelOpen] = useState(false)
  const [articleFormOpen, setArticleFormOpen] = useState(false)

  const [categorySlug, setCategorySlug] = useState('')
  const [categoryName, setCategoryName] = useState('')

  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [summary, setSummary] = useState('')
  const [body, setBody] = useState('')
  const [status, setStatus] = useState<ArticleStatus>('draft')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editSlug, setEditSlug] = useState('')
  const [editCategoryId, setEditCategoryId] = useState('')
  const [editSummary, setEditSummary] = useState('')
  const [editBody, setEditBody] = useState('')
  const [editStatus, setEditStatus] = useState<ArticleStatus>('draft')

  async function refresh() {
    setLoading(true)
    try {
      const [nextArticles, nextCategories] = await Promise.all([
        api.listAllArticles(),
        api.listArticleCategories(),
      ])
      setArticles(nextArticles)
      setCategories(nextCategories)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  useEffect(() => {
    if (!categoryId && categories.length > 0) {
      setCategoryId(categories[0].id)
    }
  }, [categoryId, categories])

  useEffect(() => {
    if (categoryId && !categories.some(category => category.id === categoryId)) {
      setCategoryId(categories[0]?.id ?? '')
    }
  }, [categoryId, categories])

  useEffect(() => {
    if (editCategoryId && !categories.some(category => category.id === editCategoryId)) {
      setEditCategoryId(categories[0]?.id ?? '')
    }
  }, [editCategoryId, categories])

  function resetArticleForm() {
    setTitle('')
    setSlug('')
    setCategoryId(categories[0]?.id ?? '')
    setSummary('')
    setBody('')
    setStatus('draft')
  }

  function startEdit(article: Article) {
    setError(null)
    setEditingId(article.id)
    setEditTitle(article.title)
    setEditSlug(article.slug)
    setEditCategoryId(article.categoryId)
    setEditSummary(article.summary)
    setEditBody(article.body)
    setEditStatus(article.status)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditTitle('')
    setEditSlug('')
    setEditCategoryId('')
    setEditSummary('')
    setEditBody('')
    setEditStatus('draft')
  }

  function getCategoryName(articleCategoryId: string) {
    return categories.find(category => category.id === articleCategoryId)?.name ?? 'Không rõ chuyên mục'
  }

  async function handleCreateCategory(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await api.createArticleCategory({
        slug: categorySlug.trim(),
        name: categoryName.trim(),
      })
      setCategorySlug('')
      setCategoryName('')
      await refresh()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function handleDeleteCategory(id: string) {
    setError(null)
    try {
      await api.deleteArticleCategory(id)
      await refresh()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function handleCreateArticle(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await api.createArticle({
        title: title.trim(),
        slug: slug.trim(),
        categoryId,
        summary: summary.trim(),
        body: body.trim(),
        status,
      })
      setArticleFormOpen(false)
      resetArticleForm()
      await refresh()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function handleSaveEdit(e: React.FormEvent, id: string) {
    e.preventDefault()
    setError(null)
    try {
      await api.updateArticle(id, {
        title: editTitle.trim(),
        slug: editSlug.trim(),
        categoryId: editCategoryId,
        summary: editSummary.trim(),
        body: editBody.trim(),
        status: editStatus,
      })
      cancelEdit()
      await refresh()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function handleDeleteArticle(id: string) {
    setError(null)
    try {
      await api.deleteArticle(id)
      await refresh()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-3 gap-2">
        <h2 className="text-base font-semibold text-gray-800">Quản lý bài viết</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCategoryPanelOpen(value => !value)}
            className="px-3 py-1.5 text-sm rounded-md border border-gray-300 hover:bg-gray-50"
          >
            Quản lý chuyên mục
          </button>
          <button
            onClick={() => setArticleFormOpen(value => !value)}
            className="px-3 py-1.5 text-sm rounded-md border border-gray-300 hover:bg-gray-50"
          >
            Thêm bài viết
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {categoryPanelOpen && (
        <div className="border border-gray-200 rounded-lg p-3 mb-4">
          <div className="space-y-2 mb-3">
            {categories.map(category => (
              <div key={category.id} className="flex items-center justify-between gap-3">
                <p className="text-sm text-gray-700">
                  {category.name} ({articles.filter(article => article.categoryId === category.id).length})
                </p>
                <button
                  onClick={() => handleDeleteCategory(category.id)}
                  aria-label={`Xóa chuyên mục ${category.name}`}
                  className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-md hover:bg-red-700"
                >
                  Xóa
                </button>
              </div>
            ))}
          </div>

          <form onSubmit={handleCreateCategory} className="flex flex-col gap-3 max-w-sm">
            <div>
              <label htmlFor="new-category-slug" className="block text-sm text-gray-600 mb-1">Slug chuyên mục</label>
              <input
                id="new-category-slug"
                value={categorySlug}
                onChange={e => setCategorySlug(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label htmlFor="new-category-name" className="block text-sm text-gray-600 mb-1">Tên chuyên mục</label>
              <input
                id="new-category-name"
                value={categoryName}
                onChange={e => setCategoryName(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
              />
            </div>
            <div className="flex justify-end">
              <button type="submit" className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700">
                Thêm chuyên mục
              </button>
            </div>
          </form>
        </div>
      )}

      {articleFormOpen && (
        <form onSubmit={handleCreateArticle} className="border border-gray-200 rounded-lg p-3 mb-4 flex flex-col gap-3">
          <div>
            <label htmlFor="new-article-title" className="block text-sm text-gray-600 mb-1">Tiêu đề</label>
            <input
              id="new-article-title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label htmlFor="new-article-slug" className="block text-sm text-gray-600 mb-1">Slug</label>
            <input
              id="new-article-slug"
              value={slug}
              onChange={e => setSlug(e.target.value)}
              required
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label htmlFor="new-article-category" className="block text-sm text-gray-600 mb-1">Chuyên mục</label>
            <select
              id="new-article-category"
              value={categoryId}
              onChange={e => setCategoryId(e.target.value)}
              required
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
            >
              {categories.map(category => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="new-article-summary" className="block text-sm text-gray-600 mb-1">Tóm tắt</label>
            <textarea
              id="new-article-summary"
              value={summary}
              onChange={e => setSummary(e.target.value)}
              required
              rows={3}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label htmlFor="new-article-body" className="block text-sm text-gray-600 mb-1">Nội dung</label>
            <textarea
              id="new-article-body"
              value={body}
              onChange={e => setBody(e.target.value)}
              required
              rows={6}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label htmlFor="new-article-status" className="block text-sm text-gray-600 mb-1">Trạng thái</label>
            <select
              id="new-article-status"
              value={status}
              onChange={e => setStatus(e.target.value as ArticleStatus)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
            >
              <option value="draft">Nháp</option>
              <option value="published">Đã đăng</option>
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setArticleFormOpen(false)
                resetArticleForm()
              }}
              className="px-4 py-2 text-sm rounded-md border border-gray-300 hover:bg-gray-50"
            >
              Hủy
            </button>
            <button type="submit" className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700">
              Tạo
            </button>
          </div>
        </form>
      )}

      {loading && <p role="status" className="text-sm text-gray-400">Đang tải…</p>}

      <ul className="space-y-2">
        {articles.map(article => (
          <li key={article.id} className="border border-gray-200 rounded-lg p-3">
            {editingId === article.id ? (
              <form onSubmit={e => handleSaveEdit(e, article.id)} className="flex flex-col gap-3">
                <div>
                  <label htmlFor={`edit-title-${article.id}`} className="block text-sm text-gray-600 mb-1">Tiêu đề</label>
                  <input
                    id={`edit-title-${article.id}`}
                    value={editTitle}
                    onChange={e => setEditTitle(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label htmlFor={`edit-slug-${article.id}`} className="block text-sm text-gray-600 mb-1">Slug</label>
                  <input
                    id={`edit-slug-${article.id}`}
                    value={editSlug}
                    onChange={e => setEditSlug(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label htmlFor={`edit-category-${article.id}`} className="block text-sm text-gray-600 mb-1">Chuyên mục</label>
                  <select
                    id={`edit-category-${article.id}`}
                    value={editCategoryId}
                    onChange={e => setEditCategoryId(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
                  >
                    {categories.map(category => (
                      <option key={category.id} value={category.id}>{category.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor={`edit-summary-${article.id}`} className="block text-sm text-gray-600 mb-1">Tóm tắt</label>
                  <textarea
                    id={`edit-summary-${article.id}`}
                    value={editSummary}
                    onChange={e => setEditSummary(e.target.value)}
                    required
                    rows={3}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label htmlFor={`edit-body-${article.id}`} className="block text-sm text-gray-600 mb-1">Nội dung</label>
                  <textarea
                    id={`edit-body-${article.id}`}
                    value={editBody}
                    onChange={e => setEditBody(e.target.value)}
                    required
                    rows={6}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label htmlFor={`edit-status-${article.id}`} className="block text-sm text-gray-600 mb-1">Trạng thái</label>
                  <select
                    id={`edit-status-${article.id}`}
                    value={editStatus}
                    onChange={e => setEditStatus(e.target.value as ArticleStatus)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
                  >
                    <option value="draft">Nháp</option>
                    <option value="published">Đã đăng</option>
                  </select>
                </div>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={cancelEdit} className="px-4 py-2 text-sm rounded-md border border-gray-300 hover:bg-gray-50">
                    Hủy
                  </button>
                  <button type="submit" className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700">
                    Lưu
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-gray-800">{article.title}</p>
                  <p className="text-xs text-gray-500">{getCategoryName(article.categoryId)}</p>
                  <p className="text-xs text-gray-500">{getStatusLabel(article.status)}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => startEdit(article)}
                    className="px-3 py-1.5 text-sm rounded-md border border-gray-300 hover:bg-gray-50"
                  >
                    Sửa
                  </button>
                  <button
                    onClick={() => handleDeleteArticle(article.id)}
                    aria-label={`Xóa bài viết ${article.title}`}
                    className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-md hover:bg-red-700"
                  >
                    Xóa
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
