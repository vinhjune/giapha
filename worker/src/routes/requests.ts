import { Hono } from 'hono'
import { drizzle } from 'drizzle-orm/d1'
import { eq, desc } from 'drizzle-orm'
import { editorRequests } from '../db/schema'
import { requireRole } from '../middleware/auth'
import { createPersonRecord, updatePersonRecord, deletePersonRecord } from './editor'
import type { PersonPayload } from './editor'
import type { HonoEnv } from '../types'
import type { DB } from '../lib/reshape'

const requestRoutes = new Hono<HonoEnv>()

requestRoutes.get('/requests', requireRole('admin', 'editor'), async (c) => {
  const db = drizzle(c.env.giapha_db) as DB
  const user = c.get('user')!
  const rows = user.role === 'admin'
    ? await db.select().from(editorRequests).orderBy(desc(editorRequests.createdAt)).all()
    : await db.select().from(editorRequests).where(eq(editorRequests.submittedBy, user.id)).orderBy(desc(editorRequests.createdAt)).all()
  return c.json({ requests: rows })
})

requestRoutes.post('/requests/:id/approve', requireRole('admin'), async (c) => {
  const db = drizzle(c.env.giapha_db) as DB
  const user = c.get('user')!
  const id = c.req.param('id')
  const request = await db.select().from(editorRequests).where(eq(editorRequests.id, id)).get()
  if (!request) return c.json({ error: 'Không tìm thấy yêu cầu' }, 404)
  if (request.status !== 'pending') return c.json({ error: 'Yêu cầu đã được xử lý' }, 409)

  // For 'delete', mark the request approved *before* removing the person: `editor_requests.person_id`
  // has ON DELETE SET NULL, so deleting the person first would just null the column (harmless), but
  // updating the status afterward would still work fine too — this order simply keeps things predictable
  // and avoids ever reading a stale `request.personId` after the person row is gone.
  if (request.type === 'delete') {
    await db.update(editorRequests)
      .set({ status: 'approved', resolvedBy: user.id, resolvedAt: new Date().toISOString() })
      .where(eq(editorRequests.id, id))
    await deletePersonRecord(db, request.personId!)
    return c.json({ ok: true })
  }

  let createdPersonId: string | null = null
  if (request.type === 'create') {
    createdPersonId = await createPersonRecord(db, JSON.parse(request.payload!) as PersonPayload)
  } else {
    await updatePersonRecord(db, request.personId!, JSON.parse(request.payload!) as PersonPayload)
  }

  await db.update(editorRequests)
    .set({
      status: 'approved', resolvedBy: user.id, resolvedAt: new Date().toISOString(),
      ...(createdPersonId ? { personId: createdPersonId } : {}),
    })
    .where(eq(editorRequests.id, id))
  return c.json({ ok: true })
})

requestRoutes.post('/requests/:id/reject', requireRole('admin'), async (c) => {
  const db = drizzle(c.env.giapha_db) as DB
  const user = c.get('user')!
  const id = c.req.param('id')
  const request = await db.select().from(editorRequests).where(eq(editorRequests.id, id)).get()
  if (!request) return c.json({ error: 'Không tìm thấy yêu cầu' }, 404)
  if (request.status !== 'pending') return c.json({ error: 'Yêu cầu đã được xử lý' }, 409)

  await db.update(editorRequests)
    .set({ status: 'rejected', resolvedBy: user.id, resolvedAt: new Date().toISOString() })
    .where(eq(editorRequests.id, id))
  return c.json({ ok: true })
})

export default requestRoutes
