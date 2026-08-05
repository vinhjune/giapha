import { Hono } from 'hono'
import { drizzle } from 'drizzle-orm/d1'
import { asc, and, eq, ne } from 'drizzle-orm'
import { articleCategories, articles } from '../db/schema'
import { requireRole } from '../middleware/auth'
import type { HonoEnv } from '../types'
import type { DB } from '../lib/reshape'

const articleRoutes = new Hono<HonoEnv>()
const ARTICLE_STATUSES = ['draft', 'published'] as const

function isValidArticleStatus(status: string): status is (typeof ARTICLE_STATUSES)[number] {
  return ARTICLE_STATUSES.includes(status as (typeof ARTICLE_STATUSES)[number])
}

articleRoutes.get('/articles', async (c) => {
  const db = drizzle(c.env.giapha_db) as DB
  const rows = await db.select().from(articles)
    .where(eq(articles.status, 'published'))
    .orderBy(asc(articles.displayOrder))
    .all()
  return c.json(rows)
})

articleRoutes.get('/articles/all', requireRole('admin', 'editor'), async (c) => {
  const db = drizzle(c.env.giapha_db) as DB
  const rows = await db.select().from(articles).orderBy(asc(articles.displayOrder)).all()
  return c.json(rows)
})

articleRoutes.post('/articles', requireRole('admin', 'editor'), async (c) => {
  const db = drizzle(c.env.giapha_db) as DB
  const user = c.get('user')!
  const body = await c.req.json<{
    slug: string
    categoryId: string
    title: string
    summary: string
    body: string
    status?: 'draft' | 'published'
    displayOrder?: number
  }>()

  const slug = body.slug?.trim()
  const categoryId = body.categoryId?.trim()
  const title = body.title?.trim()
  const summary = body.summary?.trim()
  const content = body.body?.trim()

  if (!slug || !categoryId || !title || !summary || !content) {
    return c.json({ error: 'Thiếu slug, chuyên mục, tiêu đề, tóm tắt hoặc nội dung bài viết' }, 400)
  }
  if (body.status !== undefined && !isValidArticleStatus(body.status)) {
    return c.json({ error: 'Trạng thái bài viết không hợp lệ' }, 400)
  }

  const category = await db.select({ id: articleCategories.id }).from(articleCategories).where(eq(articleCategories.id, categoryId)).get()
  if (!category) return c.json({ error: 'Chuyên mục không tồn tại' }, 400)

  const existing = await db.select({ id: articles.id }).from(articles).where(eq(articles.slug, slug)).get()
  if (existing) return c.json({ error: 'Slug bài viết đã tồn tại' }, 409)

  const id = crypto.randomUUID()
  const status = body.status ?? 'draft'
  await db.insert(articles).values({
    id,
    slug,
    categoryId,
    title,
    summary,
    body: content,
    status,
    displayOrder: body.displayOrder ?? 0,
    publishedAt: status === 'published' ? new Date().toISOString() : null,
    authorId: user.id,
  })

  const row = await db.select().from(articles).where(eq(articles.id, id)).get()
  return c.json(row!, 201)
})

articleRoutes.put('/articles/:id', requireRole('admin', 'editor'), async (c) => {
  const db = drizzle(c.env.giapha_db) as DB
  const id = c.req.param('id')
  const target = await db.select().from(articles).where(eq(articles.id, id)).get()
  if (!target) return c.json({ error: 'Không tìm thấy bài viết' }, 404)

  const body = await c.req.json<{
    slug?: string
    categoryId?: string
    title?: string
    summary?: string
    body?: string
    status?: 'draft' | 'published'
    displayOrder?: number
  }>()

  const updates: Partial<typeof articles.$inferInsert> = {}

  if (body.status !== undefined && !isValidArticleStatus(body.status)) {
    return c.json({ error: 'Trạng thái bài viết không hợp lệ' }, 400)
  }

  if (body.slug !== undefined) {
    const slug = body.slug.trim()
    if (!slug) return c.json({ error: 'Slug không được để trống' }, 400)
    if (slug !== target.slug) {
      const existing = await db.select({ id: articles.id }).from(articles)
        .where(and(eq(articles.slug, slug), ne(articles.id, id))).get()
      if (existing) return c.json({ error: 'Slug bài viết đã tồn tại' }, 409)
    }
    updates.slug = slug
  }

  if (body.categoryId !== undefined) {
    const categoryId = body.categoryId.trim()
    if (!categoryId) return c.json({ error: 'Chuyên mục không được để trống' }, 400)
    if (categoryId !== target.categoryId) {
      const category = await db.select({ id: articleCategories.id }).from(articleCategories).where(eq(articleCategories.id, categoryId)).get()
      if (!category) return c.json({ error: 'Chuyên mục không tồn tại' }, 400)
    }
    updates.categoryId = categoryId
  }

  if (body.title !== undefined) {
    const title = body.title.trim()
    if (!title) return c.json({ error: 'Tiêu đề không được để trống' }, 400)
    updates.title = title
  }

  if (body.summary !== undefined) {
    const summary = body.summary.trim()
    if (!summary) return c.json({ error: 'Tóm tắt không được để trống' }, 400)
    updates.summary = summary
  }

  if (body.body !== undefined) {
    const content = body.body.trim()
    if (!content) return c.json({ error: 'Nội dung không được để trống' }, 400)
    updates.body = content
  }

  if (body.status !== undefined) updates.status = body.status
  if (body.displayOrder !== undefined) updates.displayOrder = body.displayOrder

  const resultingStatus = updates.status ?? target.status
  if (resultingStatus === 'published') {
    updates.publishedAt = target.publishedAt ?? new Date().toISOString()
  } else {
    updates.publishedAt = null
  }

  if (Object.keys(updates).length > 0) {
    updates.updatedAt = new Date().toISOString()
    await db.update(articles).set(updates).where(eq(articles.id, id))
  }

  const row = await db.select().from(articles).where(eq(articles.id, id)).get()
  return c.json(row!)
})

articleRoutes.delete('/articles/:id', requireRole('admin', 'editor'), async (c) => {
  const db = drizzle(c.env.giapha_db) as DB
  const id = c.req.param('id')
  const target = await db.select({ id: articles.id }).from(articles).where(eq(articles.id, id)).get()
  if (!target) return c.json({ error: 'Không tìm thấy bài viết' }, 404)

  await db.delete(articles).where(eq(articles.id, id))
  return new Response(null, { status: 204 })
})

articleRoutes.post('/articles/:id/cover', requireRole('admin', 'editor'), async (c) => {
  const db = drizzle(c.env.giapha_db) as DB
  const id = c.req.param('id')
  const target = await db.select({ id: articles.id }).from(articles).where(eq(articles.id, id)).get()
  if (!target) return c.json({ error: 'Không tìm thấy bài viết' }, 404)

  const formData = await c.req.formData()
  const file = formData.get('file') as File | null
  if (!file) return c.json({ error: 'Thiếu tệp ảnh bìa' }, 400)

  const ext = file.name.split('.').pop() ?? 'jpg'
  const key = `article-covers/${id}.${ext}`
  await c.env.giapha_avatars.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type },
  })

  await db.update(articles).set({
    coverImageKey: key,
    updatedAt: new Date().toISOString(),
  }).where(eq(articles.id, id))

  const row = await db.select().from(articles).where(eq(articles.id, id)).get()
  return c.json(row!)
})

export default articleRoutes
