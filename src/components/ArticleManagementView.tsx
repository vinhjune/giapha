import { useEffect, useMemo, useState } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import * as api from '../services/api'
import type { Article, ArticleCategory } from '../types/giapha'
import RichTextEditor from './RichTextEditor'

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

  const [categoryName, setCategoryName] = useState('')
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)
  const [editCategoryName, setEditCategoryName] = useState('')

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

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.displayOrder - b.displayOrder),
    [categories],
  )

  const sortedArticles = useMemo(
    () => [...articles].sort((a, b) => a.displayOrder - b.displayOrder),
    [articles],
  )

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
        name: categoryName.trim(),
      })
      setCategoryName('')
      await refresh()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  function startEditCategory(category: ArticleCategory) {
    setError(null)
    setEditingCategoryId(category.id)
    setEditCategoryName(category.name)
  }

  function cancelEditCategory() {
    setEditingCategoryId(null)
    setEditCategoryName('')
  }

  async function handleSaveCategoryName(e: React.FormEvent, id: string) {
    e.preventDefault()
    setError(null)
    try {
      await api.updateArticleCategory(id, { name: editCategoryName.trim() })
      cancelEditCategory()
      await refresh()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function handleReorderCategories(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = sortedCategories.findIndex(category => category.id === active.id)
    const newIndex = sortedCategories.findIndex(category => category.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const reordered = arrayMove(sortedCategories, oldIndex, newIndex)
    const order = reordered.map((category, index) => ({ id: category.id, displayOrder: index }))
    const displayOrderById = new Map(order.map(item => [item.id, item.displayOrder]))

    // Optimistically reflect the new order before the request resolves.
    setCategories(prev => prev.map(category => (
      displayOrderById.has(category.id)
        ? { ...category, displayOrder: displayOrderById.get(category.id)! }
        : category
    )))

    setError(null)
    try {
      await api.reorderArticleCategories(order)
      await refresh()
    } catch (e) {
      setError((e as Error).message)
      await refresh()
    }
  }

  async function handleReorderArticles(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = sortedArticles.findIndex(article => article.id === active.id)
    const newIndex = sortedArticles.findIndex(article => article.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    // Reordering the flat list and assigning sequential displayOrder values keeps the
    // relative order of articles within the same category correct, since the landing
    // page sorts by category first and only falls back to displayOrder as a tie-breaker.
    const reordered = arrayMove(sortedArticles, oldIndex, newIndex)
    const order = reordered.map((article, index) => ({ id: article.id, displayOrder: index }))
    const displayOrderById = new Map(order.map(item => [item.id, item.displayOrder]))

    setArticles(prev => prev.map(article => (
      displayOrderById.has(article.id)
        ? { ...article, displayOrder: displayOrderById.get(article.id)! }
        : article
    )))

    setError(null)
    try {
      await api.reorderArticles(order)
      await refresh()
    } catch (e) {
      setError((e as Error).message)
      await refresh()
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

  async function handleUploadCover(id: string, file: File) {
    setError(null)
    try {
      await api.uploadArticleCover(id, file)
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

  const categorySensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const articleSensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

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
          <DndContext sensors={categorySensors} collisionDetection={closestCenter} onDragEnd={handleReorderCategories}>
            <SortableContext items={sortedCategories.map(category => category.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2 mb-3">
                {sortedCategories.map(category => (
                  <SortableCategoryRow
                    key={category.id}
                    category={category}
                    articleCount={articles.filter(article => article.categoryId === category.id).length}
                    isEditing={editingCategoryId === category.id}
                    editCategoryName={editCategoryName}
                    onEditNameChange={setEditCategoryName}
                    onStartEdit={() => startEditCategory(category)}
                    onCancelEdit={cancelEditCategory}
                    onSave={e => handleSaveCategoryName(e, category.id)}
                    onDelete={() => handleDeleteCategory(category.id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          <form onSubmit={handleCreateCategory} className="flex flex-col gap-3 max-w-sm">
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
            <RichTextEditor id="new-article-body" value={body} onChange={setBody} ariaLabel="Nội dung bài viết mới" />
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

      <DndContext sensors={articleSensors} collisionDetection={closestCenter} onDragEnd={handleReorderArticles}>
        <SortableContext items={sortedArticles.map(article => article.id)} strategy={verticalListSortingStrategy}>
          <ul className="space-y-2">
            {sortedArticles.map(article => (
              <SortableArticleRow
                key={article.id}
                article={article}
                categories={categories}
                categoryName={getCategoryName(article.categoryId)}
                isEditing={editingId === article.id}
                editTitle={editTitle}
                setEditTitle={setEditTitle}
                editSlug={editSlug}
                setEditSlug={setEditSlug}
                editCategoryId={editCategoryId}
                setEditCategoryId={setEditCategoryId}
                editSummary={editSummary}
                setEditSummary={setEditSummary}
                editBody={editBody}
                setEditBody={setEditBody}
                editStatus={editStatus}
                setEditStatus={setEditStatus}
                onSaveEdit={e => handleSaveEdit(e, article.id)}
                onCancelEdit={cancelEdit}
                onStartEdit={() => startEdit(article)}
                onDelete={() => handleDeleteArticle(article.id)}
                onUploadCover={file => handleUploadCover(article.id, file)}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
    </div>
  )
}

function SortableArticleRow({
  article,
  categories,
  categoryName,
  isEditing,
  editTitle,
  setEditTitle,
  editSlug,
  setEditSlug,
  editCategoryId,
  setEditCategoryId,
  editSummary,
  setEditSummary,
  editBody,
  setEditBody,
  editStatus,
  setEditStatus,
  onSaveEdit,
  onCancelEdit,
  onStartEdit,
  onDelete,
  onUploadCover,
}: {
  article: Article
  categories: ArticleCategory[]
  categoryName: string
  isEditing: boolean
  editTitle: string
  setEditTitle: (value: string) => void
  editSlug: string
  setEditSlug: (value: string) => void
  editCategoryId: string
  setEditCategoryId: (value: string) => void
  editSummary: string
  setEditSummary: (value: string) => void
  editBody: string
  setEditBody: (value: string) => void
  editStatus: ArticleStatus
  setEditStatus: (value: ArticleStatus) => void
  onSaveEdit: (e: React.FormEvent) => void
  onCancelEdit: () => void
  onStartEdit: () => void
  onDelete: () => void
  onUploadCover: (file: File) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: article.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <li ref={setNodeRef} style={style} className="border border-gray-200 rounded-lg p-3">
      {isEditing ? (
        <form onSubmit={onSaveEdit} className="flex flex-col gap-3">
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
            <RichTextEditor
              id={`edit-body-${article.id}`}
              value={editBody}
              onChange={setEditBody}
              ariaLabel={`Nội dung bài viết ${article.title}`}
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
            <button type="button" onClick={onCancelEdit} className="px-4 py-2 text-sm rounded-md border border-gray-300 hover:bg-gray-50">
              Hủy
            </button>
            <button type="submit" className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700">
              Lưu
            </button>
          </div>
        </form>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              {...attributes}
              {...listeners}
              aria-label={`Kéo để sắp xếp lại bài viết ${article.title}`}
              className="cursor-grab active:cursor-grabbing px-1 text-gray-400 hover:text-gray-600 shrink-0"
            >
              ⠿
            </button>
            {article.coverImageKey && (
              <img
                src={`/api/avatars/${article.coverImageKey}`}
                alt=""
                className="w-12 h-12 object-cover rounded-md border border-gray-200 shrink-0"
              />
            )}
            <div>
              <p className="text-sm font-medium text-gray-800">{article.title}</p>
              <p className="text-xs text-gray-500">{categoryName}</p>
              <p className="text-xs text-gray-500">{getStatusLabel(article.status)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <label className="px-3 py-1.5 text-sm rounded-md border border-gray-300 hover:bg-gray-50 cursor-pointer">
              Ảnh bìa
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                aria-label={`Tải ảnh bìa cho ${article.title}`}
                onChange={e => {
                  const file = e.target.files?.[0]
                  if (file) onUploadCover(file)
                  e.target.value = ''
                }}
              />
            </label>
            <button
              onClick={onStartEdit}
              className="px-3 py-1.5 text-sm rounded-md border border-gray-300 hover:bg-gray-50"
            >
              Sửa
            </button>
            <button
              onClick={onDelete}
              aria-label={`Xóa bài viết ${article.title}`}
              className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-md hover:bg-red-700"
            >
              Xóa
            </button>
          </div>
        </div>
      )}
    </li>
  )
}

function SortableCategoryRow({
  category,
  articleCount,
  isEditing,
  editCategoryName,
  onEditNameChange,
  onStartEdit,
  onCancelEdit,
  onSave,
  onDelete,
}: {
  category: ArticleCategory
  articleCount: number
  isEditing: boolean
  editCategoryName: string
  onEditNameChange: (value: string) => void
  onStartEdit: () => void
  onCancelEdit: () => void
  onSave: (e: React.FormEvent) => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: category.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  if (isEditing) {
    return (
      <form
        ref={setNodeRef}
        style={style}
        onSubmit={onSave}
        className="flex items-center gap-2"
      >
        <input
          value={editCategoryName}
          onChange={e => onEditNameChange(e.target.value)}
          required
          aria-label={`Sửa tên chuyên mục ${category.name}`}
          className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-md"
        />
        <button type="submit" className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700">
          Lưu
        </button>
        <button type="button" onClick={onCancelEdit} className="px-3 py-1.5 text-sm rounded-md border border-gray-300 hover:bg-gray-50">
          Hủy
        </button>
      </form>
    )
  }

  return (
    <div ref={setNodeRef} style={style} className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Kéo để sắp xếp lại chuyên mục ${category.name}`}
          className="cursor-grab active:cursor-grabbing px-1 text-gray-400 hover:text-gray-600"
        >
          ⠿
        </button>
        <p className="text-sm text-gray-700">
          {category.name} ({articleCount})
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onStartEdit}
          className="px-3 py-1.5 text-sm rounded-md border border-gray-300 hover:bg-gray-50"
        >
          Sửa
        </button>
        <button
          onClick={onDelete}
          aria-label={`Xóa chuyên mục ${category.name}`}
          className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-md hover:bg-red-700"
        >
          Xóa
        </button>
      </div>
    </div>
  )
}
