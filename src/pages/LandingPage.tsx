import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { listArticleCategories, listArticles, listEvents } from '../services/api'
import type { Article, ArticleCategory, EventItem } from '../types/giapha'
import { useAuthStore } from '../store/useAuthStore'
import LoginModal from '../components/LoginModal'
import './LandingPage.css'

const SITE_NAME = 'Gia phả họ Hoàng'
const SITE_TAGLINE = 'Làng Mỹ Lộc'

const THUMB_CLASSES = ['lp-thumb-0', 'lp-thumb-1', 'lp-thumb-2', 'lp-thumb-3']

function formatEventDate(event: EventItem): string {
  if (event.day && event.month && event.year) {
    return `${String(event.day).padStart(2, '0')}/${String(event.month).padStart(2, '0')}/${event.year}`
  }

  if (event.day && event.month) {
    return `${String(event.day).padStart(2, '0')}/${String(event.month).padStart(2, '0')}`
  }

  return event.dateText || 'Đang cập nhật thời gian'
}

const VIETNAMESE_MONTH_LABEL = (month: number) => `Tháng ${month}`

function formatArticleDate(publishedAt: string | null): string {
  if (!publishedAt) return 'Chưa xuất bản'

  const date = new Date(publishedAt)
  if (Number.isNaN(date.getTime())) return 'Chưa xuất bản'

  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${day}.${month}.${date.getFullYear()}`
}

function estimateReadingMinutes(body: string): string {
  const plainText = body.replace(/<[^>]*>/g, ' ')
  const wordCount = plainText.trim().split(/\s+/).filter(Boolean).length
  const minutes = Math.max(1, Math.round(wordCount / 200))
  return `${minutes} phút đọc`
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
  const { slug } = useParams<{ slug?: string }>()
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

  const articleCounts = useMemo(() => {
    return sortedArticles.reduce<Record<string, number>>((counts, article) => {
      counts[article.categoryId] = (counts[article.categoryId] ?? 0) + 1
      return counts
    }, {})
  }, [sortedArticles])

  const featuredArticle = sortedArticles[0] ?? null
  const nearestEvent = useMemo(() => pickNearestUpcomingEvent(events), [events])

  const activeArticle = useMemo(() => {
    if (!slug) return null
    return sortedArticles.find(article => article.slug === slug) ?? null
  }, [slug, sortedArticles])

  const activeCategory = useMemo(() => {
    if (!activeArticle) return null
    return sortedCategories.find(category => category.id === activeArticle.categoryId) ?? null
  }, [activeArticle, sortedCategories])

  if (loading) {
    return (
      <div className="landing-page flex min-h-screen items-center justify-center">
        <div role="status" className="animate-pulse" style={{ color: 'var(--muted)' }}>
          Đang tải...
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="landing-page flex min-h-screen items-center justify-center px-4">
        <div role="alert" className="text-center text-red-500">
          Lỗi tải dữ liệu: {error}
        </div>
      </div>
    )
  }

  // Only the very first article overall becomes the hero "featured" entry; every
  // other article (across every category) renders as a flat, chronological entry —
  // mirroring mockup-3-split-hub.html's single-hero + flat-feed layout.
  const remainingAfterFeatured = featuredArticle ? sortedArticles.slice(1) : sortedArticles
  const firstArticleIdByCategory = new Map<string, string>()
  for (const article of sortedArticles) {
    if (!firstArticleIdByCategory.has(article.categoryId)) {
      firstArticleIdByCategory.set(article.categoryId, article.id)
    }
  }

  return (
    <div className="landing-page">
      <header className="lp-header">
        <div className="lp-container lp-header-inner">
          <Link className="lp-brand" to="/" aria-label={`Trang chủ ${SITE_NAME}`}>
            <span className="lp-seal" aria-hidden="true">
              黃
            </span>
            <span>
              <strong>{SITE_NAME}</strong>
              <small>{SITE_TAGLINE}</small>
            </span>
          </Link>
          <span className="lp-header-note">Một kho ký ức chung của gia đình</span>
          {user ? (
            <Link className="lp-login-link" to="/control-panel">
              Quản lý
            </Link>
          ) : (
            <button type="button" className="lp-login-link" onClick={() => setLoginModalOpen(true)}>
              Đăng nhập
            </button>
          )}
          <Link className="lp-tree-button" to="/gia-pha">
            Xem gia phả <span aria-hidden="true">→</span>
          </Link>
        </div>
      </header>

      {loginModalOpen && <LoginModal onClose={() => setLoginModalOpen(false)} />}

      <nav className="lp-mobile-categories" aria-label="Chuyên mục trên di động">
        {sortedCategories.map(category => (
          <a key={category.id} href={`#${getCategoryAnchorId(category)}`}>
            {category.name}
          </a>
        ))}
      </nav>

      <main>
        <section className="lp-masthead">
          <div className="lp-container lp-masthead-grid">
            <p>
              Tư liệu được góp nhặt từ gia phả giấy, lời kể của người thân và các bài viết mới để con
              cháu gần xa cùng đọc lại.
            </p>
            <div>
              <span className="lp-edition">Thư viện gia đình</span>
              <h1>Chuyện một dòng họ, viết qua nhiều đời.</h1>
            </div>
          </div>
        </section>

        <div className="lp-container lp-layout">
          <aside className="lp-sidebar" aria-label="Điều hướng chuyên mục">
            <p className="lp-side-label">Chuyên mục</p>
            <nav className="lp-categories">
              {sortedCategories.map((category, index) => {
                const isActive = activeArticle ? category.id === activeCategory?.id : index === 0
                return (
                  <a
                    key={category.id}
                    href={`/#${getCategoryAnchorId(category)}`}
                    className={`lp-category${isActive ? ' lp-active' : ''}`}
                  >
                    {category.name}
                    <span>{articleCounts[category.id] ?? 0}</span>
                  </a>
                )
              })}
            </nav>
          </aside>

          <section aria-label="Dòng bài viết" className="lp-feed">
            {slug ? (
              activeArticle ? (
                <>
                  <div className="lp-feed-head">
                    <div>
                      <Link to="/" className="lp-edition lp-back-link">
                        ← Quay lại
                      </Link>
                      <h2>{activeArticle.title}</h2>
                    </div>
                    <span>
                      {activeCategory?.name ?? 'Bài viết'} · {formatArticleDate(activeArticle.publishedAt)}
                    </span>
                  </div>

                  <article className="lp-article">
                    {activeArticle.coverImageKey && (
                      <div className="lp-article-cover">
                        <img
                          src={`/api/avatars/${activeArticle.coverImageKey}`}
                          alt=""
                          className="lp-article-cover-img"
                        />
                      </div>
                    )}
                    <p className="lp-article-summary">{activeArticle.summary}</p>
                    <div
                      className="lp-article-body"
                      // Body HTML is sanitized server-side (xss allowlist) on every
                      // create/update, so it's safe to render directly here.
                      dangerouslySetInnerHTML={{ __html: activeArticle.body }}
                    />
                  </article>
                </>
              ) : (
                <div className="lp-empty lp-not-found">
                  <p>Không tìm thấy bài viết này.</p>
                  <Link to="/" className="lp-back-link">
                    ← Quay lại trang chủ
                  </Link>
                </div>
              )
            ) : (
              <>
                <div className="lp-feed-head">
                  <div>
                    <span className="lp-edition">Trang đầu</span>
                    <h2>Bài viết mới</h2>
                  </div>
                  <span>{sortedArticles.length} tư liệu đã được lưu giữ</span>
                </div>

                {sortedArticles.length === 0 ? (
                  <div className="lp-empty">Chưa có bài viết nào.</div>
                ) : (
                  <>
                {featuredArticle && (() => {
                  const category = sortedCategories.find(c => c.id === featuredArticle.categoryId)
                  return (
                    <Link
                      to={`/bai-viet/${featuredArticle.slug}`}
                      id={category ? getCategoryAnchorId(category) : undefined}
                      className="lp-featured"
                    >
                      <div
                        className="lp-featured-visual"
                        role="img"
                        aria-label="Ảnh minh họa bài viết nổi bật"
                      >
                        {featuredArticle.coverImageKey && (
                          <img
                            src={`/api/avatars/${featuredArticle.coverImageKey}`}
                            alt=""
                            className="lp-featured-visual-img"
                          />
                        )}
                      </div>
                      <div className="lp-featured-copy">
                        <span className="lp-meta">{category?.name ?? 'Bài viết'} · Bài tuyển chọn</span>
                        <h3>{featuredArticle.title}</h3>
                        <p>{featuredArticle.summary}</p>
                        <span className="lp-read-link">
                          Đọc trọn bài <span aria-hidden="true">→</span>
                        </span>
                      </div>
                    </Link>
                  )
                })()}

                {remainingAfterFeatured.map((article, index) => {
                  const category = sortedCategories.find(c => c.id === article.categoryId)
                  const isFirstOfCategory = firstArticleIdByCategory.get(article.categoryId) === article.id
                  const thumbClass = THUMB_CLASSES[index % THUMB_CLASSES.length]

                  return (
                    <Link
                      key={article.id}
                      to={`/bai-viet/${article.slug}`}
                      id={isFirstOfCategory && category ? getCategoryAnchorId(category) : undefined}
                      className="lp-entry"
                    >
                      <div className="lp-entry-date">
                        <strong>{formatArticleDate(article.publishedAt)}</strong>
                        {estimateReadingMinutes(article.body)}
                      </div>
                      <div className="lp-entry-body">
                        <span className="lp-meta">{category?.name ?? 'Bài viết'}</span>
                        <h3>{article.title}</h3>
                        <p>{article.summary}</p>
                      </div>
                      <div
                        className={`lp-entry-thumb${article.coverImageKey ? '' : ` ${thumbClass}`}`}
                        role="img"
                        aria-label=""
                      >
                        {article.coverImageKey && (
                          <img
                            src={`/api/avatars/${article.coverImageKey}`}
                            alt=""
                            className="lp-entry-thumb-img"
                          />
                        )}
                      </div>
                    </Link>
                  )
                })}

                <div className="lp-entry-footer">
                  <p>Các bài viết và chuyên mục mới có thể được bổ sung từ trang quản trị.</p>
                </div>
                  </>
                )}

                {nearestEvent && (
                  <aside className="lp-event-note" aria-label="Sự kiện gần nhất" data-testid="nearest-event">
                    <div className="lp-event-date">
                      {nearestEvent.month ? <span>{VIETNAMESE_MONTH_LABEL(nearestEvent.month)}</span> : null}
                      <strong>{nearestEvent.day ?? formatEventDate(nearestEvent)}</strong>
                    </div>
                    <div>
                      <h3>{nearestEvent.title}</h3>
                      <p>{nearestEvent.description || nearestEvent.dateText || 'Thông tin sự kiện đang được cập nhật.'}</p>
                    </div>
                    <Link to="/gia-pha">Xem lịch sự kiện →</Link>
                  </aside>
                )}
              </>
            )}
          </section>
        </div>
      </main>

      <section className="lp-closing">
        <div className="lp-container lp-closing-inner">
          <div>
            <h2>Từ trang sử nhà đến cây gia phả của chính bạn.</h2>
            <p>Tìm người thân, xem các thế hệ và cùng hoàn thiện mạch nối gia đình.</p>
          </div>
          <Link className="lp-tree-button" to="/gia-pha">
            Mở cây gia phả <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>

      <footer className="lp-footer">
        <div className="lp-container lp-footer-inner">
          <span>© {new Date().getFullYear()} {SITE_NAME}</span>
          <span>{SITE_TAGLINE}</span>
        </div>
      </footer>
    </div>
  )
}
