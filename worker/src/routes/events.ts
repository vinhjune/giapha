import { Hono } from 'hono'
import { drizzle } from 'drizzle-orm/d1'
import { asc, eq } from 'drizzle-orm'
import { events } from '../db/schema'
import { requireRole } from '../middleware/auth'
import type { DB } from '../lib/reshape'
import type { HonoEnv } from '../types'

const eventRoutes = new Hono<HonoEnv>()

eventRoutes.get('/events', async (c) => {
  const db = drizzle(c.env.giapha_db) as DB
  const rows = await db.select().from(events).orderBy(asc(events.createdAt)).all()
  return c.json(rows)
})

eventRoutes.post('/events', requireRole('admin', 'editor'), async (c) => {
  const db = drizzle(c.env.giapha_db) as DB
  const body = await c.req.json<{
    title?: string
    description?: string | null
    dateText?: string | null
    year?: number | null
    month?: number | null
    day?: number | null
    isLunar?: boolean
    isRecurring?: boolean
  }>()

  const title = body.title?.trim()
  if (!title) return c.json({ error: 'Thiếu tiêu đề sự kiện' }, 400)

  const id = crypto.randomUUID()
  await db.insert(events).values({
    id,
    title,
    description: body.description === undefined ? null : body.description?.trim() || null,
    dateText: body.dateText === undefined ? null : body.dateText?.trim() || null,
    year: body.year ?? null,
    month: body.month ?? null,
    day: body.day ?? null,
    isLunar: body.isLunar ?? false,
    isRecurring: body.isRecurring ?? true,
  })

  const row = await db.select().from(events).where(eq(events.id, id)).get()
  return c.json(row!, 201)
})

eventRoutes.put('/events/:id', requireRole('admin', 'editor'), async (c) => {
  const db = drizzle(c.env.giapha_db) as DB
  const id = c.req.param('id')
  const target = await db.select().from(events).where(eq(events.id, id)).get()
  if (!target) return c.json({ error: 'Không tìm thấy sự kiện' }, 404)

  const body = await c.req.json<{
    title?: string
    description?: string | null
    dateText?: string | null
    year?: number | null
    month?: number | null
    day?: number | null
    isLunar?: boolean
    isRecurring?: boolean
  }>()

  const updates: Partial<typeof events.$inferInsert> = {}

  if (body.title !== undefined) {
    const title = body.title.trim()
    if (!title) return c.json({ error: 'Thiếu tiêu đề sự kiện' }, 400)
    updates.title = title
  }

  if (body.description !== undefined) updates.description = body.description?.trim() || null
  if (body.dateText !== undefined) updates.dateText = body.dateText?.trim() || null
  if (body.year !== undefined) updates.year = body.year
  if (body.month !== undefined) updates.month = body.month
  if (body.day !== undefined) updates.day = body.day
  if (body.isLunar !== undefined) updates.isLunar = body.isLunar
  if (body.isRecurring !== undefined) updates.isRecurring = body.isRecurring

  if (Object.keys(updates).length > 0) {
    updates.updatedAt = new Date().toISOString()
    await db.update(events).set(updates).where(eq(events.id, id))
  }

  const row = await db.select().from(events).where(eq(events.id, id)).get()
  return c.json(row!)
})

eventRoutes.delete('/events/:id', requireRole('admin', 'editor'), async (c) => {
  const db = drizzle(c.env.giapha_db) as DB
  const id = c.req.param('id')
  const target = await db.select({ id: events.id }).from(events).where(eq(events.id, id)).get()
  if (!target) return c.json({ error: 'Không tìm thấy sự kiện' }, 404)

  await db.delete(events).where(eq(events.id, id))
  return new Response(null, { status: 204 })
})

export default eventRoutes
