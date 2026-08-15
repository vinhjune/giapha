import { Hono } from 'hono'
import { drizzle } from 'drizzle-orm/d1'
import { asc, count, eq } from 'drizzle-orm'
import { articleCategories, articles } from '../db/schema'
import { requireRole } from '../middleware/auth'
import type { HonoEnv } from '../types'
import type { DB } from '../lib/reshape'

const articleCategoryRoutes = new Hono<HonoEnv>()

articleCategoryRoutes.get('/article-categories', async (c) => {
  const db = drizzle(c.env.giapha_db) as DB
  const [categories, articleCounts] = await Promise.all([
    db.select().from(articleCategories).orderBy(asc(articleCategories.displayOrder)).all(),
    db.select({ categoryId: articles.categoryId, articleCount: count() })
      .from(articles)
      .where(eq(articles.status, 'published'))
      .groupBy(articles.categoryId)
      .all(),
  ])

  const countsByCategoryId = new Map(articleCounts.map((row) => [row.categoryId, row.articleCount]))
  return c.json(categories.map((category) => ({
    ...category,
    articleCount: countsByCategoryId.get(category.id) ?? 0,
  })))
})

articleCategoryRoutes.post('/article-categories', requireRole('admin', 'editor'), async (c) => {
  const db = drizzle(c.env.giapha_db) as DB
  const body = await c.req.json<{ name: string; displayOrder?: number }>()
  const name = body.name?.trim()

  if (!name) return c.json({ error: 'Thiếu tên chuyên mục' }, 400)

  const id = crypto.randomUUID()
  // slug is no longer user-facing; auto-generate an internal value from the id to satisfy the
  // NOT NULL UNIQUE constraint without requiring a schema migration.
  await db.insert(articleCategories).values({
    id,
    slug: `category-${id}`,
    name,
    displayOrder: body.displayOrder ?? 0,
  })

  const row = await db.select().from(articleCategories).where(eq(articleCategories.id, id)).get()
  return c.json(row!, 201)
})

articleCategoryRoutes.put('/article-categories/reorder', requireRole('admin', 'editor'), async (c) => {
  const db = drizzle(c.env.giapha_db) as DB
  const body = await c.req.json<{ order?: Array<{ id: string; displayOrder: number }> }>()
  const order = body.order

  if (!Array.isArray(order) || order.length === 0) {
    return c.json({ error: 'Thiếu danh sách thứ tự chuyên mục' }, 400)
  }

  const now = new Date().toISOString()
  await Promise.all(order.map(({ id, displayOrder }) =>
    db.update(articleCategories).set({ displayOrder, updatedAt: now }).where(eq(articleCategories.id, id))
  ))

  const rows = await db.select().from(articleCategories).orderBy(asc(articleCategories.displayOrder)).all()
  return c.json(rows)
})

articleCategoryRoutes.put('/article-categories/:id', requireRole('admin', 'editor'), async (c) => {
  const db = drizzle(c.env.giapha_db) as DB
  const id = c.req.param('id')
  const target = await db.select().from(articleCategories).where(eq(articleCategories.id, id)).get()
  if (!target) return c.json({ error: 'Không tìm thấy chuyên mục bài viết' }, 404)

  const body = await c.req.json<{ name?: string; displayOrder?: number }>()
  const updates: Partial<typeof articleCategories.$inferInsert> = {}

  if (body.name !== undefined) {
    const name = body.name.trim()
    if (!name) return c.json({ error: 'Tên chuyên mục không được để trống' }, 400)
    updates.name = name
  }

  if (body.displayOrder !== undefined) updates.displayOrder = body.displayOrder

  if (Object.keys(updates).length > 0) {
    updates.updatedAt = new Date().toISOString()
    await db.update(articleCategories).set(updates).where(eq(articleCategories.id, id))
  }

  const row = await db.select().from(articleCategories).where(eq(articleCategories.id, id)).get()
  return c.json(row!)
})

articleCategoryRoutes.delete('/article-categories/:id', requireRole('admin', 'editor'), async (c) => {
  const db = drizzle(c.env.giapha_db) as DB
  const id = c.req.param('id')
  const target = await db.select().from(articleCategories).where(eq(articleCategories.id, id)).get()
  if (!target) return c.json({ error: 'Không tìm thấy chuyên mục bài viết' }, 404)

  const [{ total }] = await db.select({ total: count() }).from(articles).where(eq(articles.categoryId, id))
  if (total > 0) return c.json({ error: 'Chuyên mục vẫn còn bài viết' }, 409)

  await db.delete(articleCategories).where(eq(articleCategories.id, id))
  return new Response(null, { status: 204 })
})

export default articleCategoryRoutes
