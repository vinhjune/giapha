import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { listArticleCategories, listArticles, listEvents } from '../services/api'
import type { Article, ArticleCategory, EventItem } from '../types/giapha'
import { useAuthStore } from '../store/useAuthStore'
import LoginModal from '../components/LoginModal'

const SITE_NAME = 'Sử nhà dòng họ'
const SITE_TAGLINE = 'Một kho ký ức chung của gia đình'

function formatEventDate(event: EventItem): string {
  if (event.day && event.month && event.year) {
    return `${String(event.day).padStart(2, '0')}/${String(event.month).padStart(2, '0')}/${event.year}`
  }

  if (event.day && event.month) {
    return `${String(event.day).padStart(2, '0')}/${String(event.month).padStart(2, '0')}`
  }

  return event.dateText || 'Đang cập nhật thời gian'
}

function getComparableEventDate(event: EventItem, now: Date): Date | null {
  if (event.month === null || event.day === null) return null

  if (event.isRecurring) {
    const currentYear = now.getFullYear()
    const thisYear = new Date(currentYear, event.month - 1, event.day, 12)

    if (thisYear >= now) return thisYear

    return new Date(currentYear + 1, event.month - 1, event.day, 12)
  }

  if (event.year === null) return null

  return new Date(event.year, event.month - 1, event.day, 12)
}

function pickNearestUpcomingEvent(events: EventItem[]): EventItem | null {
  if (events.length === 0) return null

  const now = new Date()
  const upcoming = events
    .map(event => ({ event, date: getComparableEventDate(event, now) }))
    .filter((item): item is { event: EventItem; date: Date } => item.date !== null && item.date >= now)
    .sort((a, b) => a.date.getTime() - b.date.getTime())

  if (upcoming.length > 0) return upcoming[0].event

  return events[0] ?? null
}

function getCategoryAnchorId(category: ArticleCategory) {
  return `category-${category.slug || category.id}`
}

export default function LandingPage() {
  const [categories, setCategories] = useState<ArticleCategory[]>([])
  const [articles, setArticles] = useState<Article[]>([])
  const [events, setEvents] = useState<EventItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [loginModalOpen, setLoginModalOpen] = useState(false)
  const { user } = useAuthStore()

  useEffect(() => {
    let cancelled = false

    async function loadLandingData() {
      try {
        setLoading(true)
        setError(null)

        const [categoryData, articleData, eventData] = await Promise.all([
          listArticleCategories(),
          listArticles(),
          listEvents(),
        ])

        if (cancelled) return

        setCategories(categoryData)
        setArticles(articleData)
        setEvents(eventData)
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Không thể tải dữ liệu.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadLandingData()

    return () => {
      cancelled = true
    }
  }, [])

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.displayOrder - b.displayOrder),
    [categories],
  )

  const sortedArticles = useMemo(() => {
    const categoryOrder = new Map(sortedCategories.map((category, index) => [category.id, index]))

    return [...articles].sort((a, b) => {
      const categoryA = categoryOrder.get(a.categoryId) ?? Number.MAX_SAFE_INTEGER
      const categoryB = categoryOrder.get(b.categoryId) ?? Number.MAX_SAFE_INTEGER

      if (categoryA !== categoryB) return categoryA - categoryB
      return a.displayOrder - b.displayOrder
    })
  }, [articles, sortedCategories])

  const articlesByCategory = useMemo(() => {
    return sortedArticles.reduce<Record<string, Article[]>>((groups, article) => {
      groups[article.categoryId] ??= []
      groups[article.categoryId].push(article)
      return groups
    }, {})
  }, [sortedArticles])

  const articleCounts = useMemo(() => {
    return sortedArticles.reduce<Record<string, number>>((counts, article) => {
      counts[article.categoryId] = (counts[article.categoryId] ?? 0) + 1
      return counts
    }, {})
  }, [sortedArticles])

  const featuredArticle = sortedArticles[0] ?? null
  const nearestEvent = useMemo(() => pickNearestUpcomingEvent(events), [events])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas">
        <div role="status" className="text-muted animate-pulse">
          Đang tải...
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas px-4">
        <div role="alert" className="text-red-500 text-center">
          Lỗi tải dữ liệu: {error}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <header className="sticky top-0 z-30 border-b border-card-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Gia phả số</p>
            <h1 className="truncate text-lg font-bold text-ink">{SITE_NAME}</h1>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {user ? (
              <Link
                to="/control-panel"
                className="inline-flex items-center rounded-full border border-card-border px-4 py-2 text-sm font-semibold text-ink transition hover:bg-slate-50"
              >
                Quản lý
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => setLoginModalOpen(true)}
                className="inline-flex items-center rounded-full border border-card-border px-4 py-2 text-sm font-semibold text-ink transition hover:bg-slate-50"
              >
                Đăng nhập
              </button>
            )}
            <Link
              to="/gia-pha"
              className="inline-flex items-center rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
            >
              Xem gia phả
            </Link>
          </div>
        </div>
      </header>

      {loginModalOpen && <LoginModal onClose={() => setLoginModalOpen(false)} />}

      <section className="border-b border-card-border bg-card">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-end lg:py-16">
          <div>
            <p className="text-sm leading-7 text-muted">
              Tư liệu được góp nhặt từ gia phả giấy, lời kể của người thân và các bài viết mới để
              con cháu gần xa cùng đọc lại.
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
              Thư viện gia đình
            </p>
            <h2 className="mt-3 text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
              Chuyện một dòng họ, viết qua nhiều đời.
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-muted">{SITE_TAGLINE}</p>
          </div>
        </div>
      </section>

      <nav
        aria-label="Chuyên mục trên di động"
        className="sticky top-[73px] z-20 flex gap-2 overflow-x-auto border-b border-card-border bg-canvas px-4 py-3 sm:px-6 lg:hidden"
      >
        {sortedCategories.map(category => (
          <a
            key={category.id}
            href={`#${getCategoryAnchorId(category)}`}
            className="inline-flex shrink-0 items-center gap-2 rounded-full border border-card-border bg-card px-3 py-2 text-sm font-medium text-ink"
          >
            <span>{category.name}</span>
            <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs text-accent">
              {articleCounts[category.id] ?? 0}
            </span>
          </a>
        ))}
      </nav>

      <main className="mx-auto grid max-w-6xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-10 lg:py-12">
        <aside className="hidden lg:block">
          <div className="sticky top-28 space-y-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                Chuyên mục
              </p>
              <nav className="mt-3 overflow-hidden rounded-2xl border border-card-border bg-card">
                {sortedCategories.map(category => (
                  <a
                    key={category.id}
                    href={`#${getCategoryAnchorId(category)}`}
                    className="flex items-center justify-between gap-3 border-b border-card-border px-4 py-3 text-sm text-ink last:border-b-0 hover:bg-slate-50"
                  >
                    <span className="font-medium">{category.name}</span>
                    <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent">
                      {articleCounts[category.id] ?? 0}
                    </span>
                  </a>
                ))}
              </nav>
            </div>

            <div className="rounded-2xl border border-card-border bg-card p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                Bài viết mới
              </p>
              <p className="mt-2 text-sm leading-6 text-muted">
                {sortedArticles.length > 0
                  ? `${sortedArticles.length} tư liệu đang hiển thị trên trang công khai.`
                  : 'Kho tư liệu đang được cập nhật dần.'}
              </p>
            </div>
          </div>
        </aside>

        <section aria-label="Dòng bài viết" className="min-w-0">
          <div className="flex flex-col gap-3 border-b-2 border-ink pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Trang đầu</p>
              <h2 className="mt-2 text-3xl font-semibold text-ink sm:text-4xl">Bài viết mới</h2>
            </div>
            <p className="text-sm text-muted">{sortedArticles.length} tư liệu đã được lưu giữ</p>
          </div>

          {sortedArticles.length === 0 ? (
            <div className="mt-8 rounded-2xl border border-dashed border-card-border bg-card p-8 text-center text-muted">
              Chưa có bài viết nào.
            </div>
          ) : (
            <div className="space-y-10 pt-8">
              {sortedCategories.map((category, categoryIndex) => {
                const categoryArticles = articlesByCategory[category.id] ?? []
                const hasFeaturedArticle = featuredArticle?.categoryId === category.id
                const remainingArticles = hasFeaturedArticle ? categoryArticles.slice(1) : categoryArticles

                return (
                  <section
                    key={category.id}
                    id={getCategoryAnchorId(category)}
                    className="scroll-mt-32"
                  >
                    <div className="mb-5 flex items-center justify-between gap-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                          Chuyên mục
                        </p>
                        <h3 className="mt-1 text-2xl font-semibold text-ink">{category.name}</h3>
                      </div>
                      <span className="rounded-full bg-accent-soft px-3 py-1 text-sm font-semibold text-accent">
                        {articleCounts[category.id] ?? 0}
                      </span>
                    </div>

                    {hasFeaturedArticle && featuredArticle && (
                      <Link
                        to={`/bai-viet/${featuredArticle.slug}`}
                        className="grid overflow-hidden rounded-3xl bg-ink text-white shadow-sm transition hover:opacity-95 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]"
                      >
                        {featuredArticle.coverImageKey ? (
                          <img
                            src={`/api/avatars/${featuredArticle.coverImageKey}`}
                            alt=""
                            className="min-h-64 w-full object-cover"
                          />
                        ) : (
                          <div className="min-h-64 bg-gradient-to-br from-accent via-slate-700 to-ink" />
                        )}
                        <div className="flex flex-col justify-center p-6 sm:p-8">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
                            {category.name} · Bài nổi bật
                          </p>
                          <h4 className="mt-3 text-3xl font-semibold tracking-tight text-white">
                            {featuredArticle.title}
                          </h4>
                          <p className="mt-4 text-sm leading-7 text-slate-200">{featuredArticle.summary}</p>
                        </div>
                      </Link>
                    )}

                    {remainingArticles.length > 0 ? (
                      <div className="mt-6 divide-y divide-card-border rounded-3xl border border-card-border bg-card">
                        {remainingArticles.map(article => (
                          <Link
                            to={`/bai-viet/${article.slug}`}
                            key={article.id}
                            className="flex gap-4 px-5 py-5 transition hover:bg-slate-50 sm:px-6"
                          >
                            {article.coverImageKey && (
                              <img
                                src={`/api/avatars/${article.coverImageKey}`}
                                alt=""
                                className="h-20 w-20 shrink-0 rounded-xl object-cover"
                              />
                            )}
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                                {category.name}
                              </p>
                              <h4 className="mt-2 text-2xl font-semibold text-ink">{article.title}</h4>
                              <p className="mt-3 text-sm leading-7 text-muted">{article.summary}</p>
                            </div>
                          </Link>
                        ))}
                      </div>
                    ) : !hasFeaturedArticle ? (
                      <div className="rounded-2xl border border-dashed border-card-border bg-card p-6 text-sm text-muted">
                        Chuyên mục này đang được cập nhật.
                      </div>
                    ) : null}

                    {categoryIndex === 0 && nearestEvent && (
                      <section className="mt-6 grid gap-4 rounded-3xl bg-accent px-5 py-5 text-white sm:grid-cols-[auto,1fr] sm:items-center sm:px-6">
                        <div className="rounded-2xl bg-white/10 px-4 py-3 text-center">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-200">
                            Sự kiện gần nhất
                          </p>
                          <p className="mt-2 text-lg font-semibold">{formatEventDate(nearestEvent)}</p>
                        </div>
                        <div>
                          <h4 className="text-xl font-semibold text-white">{nearestEvent.title}</h4>
                          <p className="mt-2 text-sm leading-7 text-slate-100">
                            {nearestEvent.description || nearestEvent.dateText || 'Thông tin sự kiện đang được cập nhật.'}
                          </p>
                        </div>
                      </section>
                    )}
                  </section>
                )
              })}
            </div>
          )}
        </section>
      </main>

      <section className="border-t border-card-border bg-card">
        <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-10 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Tiếp tục khám phá</p>
            <h2 className="mt-2 text-3xl font-semibold text-ink">Xem gia phả và nối lại các nhánh họ.</h2>
          </div>
          <Link
            to="/gia-pha"
            className="inline-flex items-center justify-center rounded-full border border-card-border bg-accent px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90"
          >
            Xem gia phả
          </Link>
        </div>
      </section>
    </div>
  )
}
