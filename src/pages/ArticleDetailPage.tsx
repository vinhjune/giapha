import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getArticleBySlug } from '../services/api'
import type { Article } from '../types/giapha'

function formatPublishedDate(publishedAt: string | null): string | null {
  if (!publishedAt) return null
  const date = new Date(publishedAt.replace(' ', 'T'))
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function ArticleDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const [article, setArticle] = useState<Article | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!slug) return
    let cancelled = false

    async function loadArticle(currentSlug: string) {
      try {
        setLoading(true)
        setError(null)
        const data = await getArticleBySlug(currentSlug)
        if (!cancelled) setArticle(data)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Không thể tải bài viết.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadArticle(slug)

    return () => {
      cancelled = true
    }
  }, [slug])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas">
        <div role="status" className="text-muted animate-pulse">
          Đang tải...
        </div>
      </div>
    )
  }

  if (error || !article) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-canvas px-4 text-center">
        <p role="alert" className="text-red-500">
          {error ? `Lỗi tải bài viết: ${error}` : 'Không tìm thấy bài viết.'}
        </p>
        <Link to="/" className="text-sm font-semibold text-accent hover:underline">
          ← Về trang chủ
        </Link>
      </div>
    )
  }

  const publishedDate = formatPublishedDate(article.publishedAt)

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <header className="sticky top-0 z-30 border-b border-card-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-4 px-4 py-3 sm:px-6">
          <Link to="/" className="text-sm font-semibold text-accent hover:underline">
            ← Trang chủ
          </Link>
        </div>
      </header>

      <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        {article.coverImageKey && (
          <img
            src={`/api/avatars/${article.coverImageKey}`}
            alt=""
            className="mb-8 h-64 w-full rounded-2xl object-cover sm:h-80"
          />
        )}

        {publishedDate && (
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">{publishedDate}</p>
        )}
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">{article.title}</h1>
        <p className="mt-4 text-base leading-7 text-muted">{article.summary}</p>

        <div className="mt-8 space-y-4 text-base leading-8 text-ink">
          {article.body.split(/\n{2,}/).map((paragraph, index) => (
            <p key={index} className="whitespace-pre-wrap">
              {paragraph}
            </p>
          ))}
        </div>
      </article>
    </div>
  )
}
