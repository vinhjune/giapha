import { describe, it, expect, beforeEach } from 'vitest'
import { drizzle } from 'drizzle-orm/d1'
import { env, SELF } from 'cloudflare:test'
import { eq } from 'drizzle-orm'
import { users, persons, editorRequests } from '../src/db/schema'
import { createSession, SESSION_COOKIE_NAME } from '../src/lib/session'

beforeEach(async () => {
  const db = drizzle(env.giapha_db)
  await db.delete(editorRequests)
  await db.delete(persons)
  await db.delete(users)
})

async function tokenFor(role: 'admin' | 'editor' | 'viewer') {
  const db = drizzle(env.giapha_db)
  const id = crypto.randomUUID()
  await db.insert(users).values({ id, username: `u-${id}`, passwordHash: 'x', role, email: 'a@example.com' })
  return { userId: id, token: await createSession(db, id) }
}

const samplePayload = { hoTen: 'Nguyễn Văn A', gioiTinh: 'nam' as const, laThanhVienHo: true, honNhan: [] }

describe('GET /api/requests', () => {
  it('rejects anonymous and returns 401', async () => {
    const res = await SELF.fetch('http://example.com/api/requests')
    expect(res.status).toBe(401)
  })

  it('editor sees only their own requests', async () => {
    const editor1 = await tokenFor('editor')
    const editor2 = await tokenFor('editor')
    await SELF.fetch('http://example.com/api/persons', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: `${SESSION_COOKIE_NAME}=${editor1.token}` },
      body: JSON.stringify(samplePayload),
    })
    await SELF.fetch('http://example.com/api/persons', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: `${SESSION_COOKIE_NAME}=${editor2.token}` },
      body: JSON.stringify(samplePayload),
    })
    const res = await SELF.fetch('http://example.com/api/requests', { headers: { Cookie: `${SESSION_COOKIE_NAME}=${editor1.token}` } })
    const body = await res.json<{ requests: { submittedBy: string }[] }>()
    expect(body.requests).toHaveLength(1)
    expect(body.requests[0].submittedBy).toBe(editor1.userId)
  })

  it('admin sees all pending requests', async () => {
    const editor1 = await tokenFor('editor')
    const editor2 = await tokenFor('editor')
    const admin = await tokenFor('admin')
    await SELF.fetch('http://example.com/api/persons', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: `${SESSION_COOKIE_NAME}=${editor1.token}` },
      body: JSON.stringify(samplePayload),
    })
    await SELF.fetch('http://example.com/api/persons', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: `${SESSION_COOKIE_NAME}=${editor2.token}` },
      body: JSON.stringify(samplePayload),
    })
    const res = await SELF.fetch('http://example.com/api/requests', { headers: { Cookie: `${SESSION_COOKIE_NAME}=${admin.token}` } })
    const body = await res.json<{ requests: unknown[] }>()
    expect(body.requests).toHaveLength(2)
  })
})

describe('POST /api/requests/:id/approve', () => {
  it('rejects non-admin with 403', async () => {
    const editor = await tokenFor('editor')
    const createRes = await SELF.fetch('http://example.com/api/persons', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: `${SESSION_COOKIE_NAME}=${editor.token}` },
      body: JSON.stringify(samplePayload),
    })
    const { requestId } = await createRes.json<{ requestId: string }>()
    const res = await SELF.fetch(`http://example.com/api/requests/${requestId}/approve`, {
      method: 'POST', headers: { Cookie: `${SESSION_COOKIE_NAME}=${editor.token}` },
    })
    expect(res.status).toBe(403)
  })

  it('approving a create request inserts the person and marks the request approved', async () => {
    const editor = await tokenFor('editor')
    const admin = await tokenFor('admin')
    const createRes = await SELF.fetch('http://example.com/api/persons', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: `${SESSION_COOKIE_NAME}=${editor.token}` },
      body: JSON.stringify(samplePayload),
    })
    const { requestId } = await createRes.json<{ requestId: string }>()
    const res = await SELF.fetch(`http://example.com/api/requests/${requestId}/approve`, {
      method: 'POST', headers: { Cookie: `${SESSION_COOKIE_NAME}=${admin.token}` },
    })
    expect(res.status).toBe(200)

    const db = drizzle(env.giapha_db)
    const rows = await db.select().from(persons).all()
    expect(rows).toHaveLength(1)
    expect(rows[0].name).toBe('Nguyễn Văn A')
    const request = await db.select().from(editorRequests).where(eq(editorRequests.id, requestId)).get()
    expect(request?.status).toBe('approved')
    expect(request?.resolvedBy).toBe(admin.userId)
    expect(request?.personId).toBe(rows[0].id)
  })

  it('approving an update request applies changes to the existing person', async () => {
    const editor = await tokenFor('editor')
    const admin = await tokenFor('admin')
    const createRes = await SELF.fetch('http://example.com/api/persons', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: `${SESSION_COOKIE_NAME}=${admin.token}` },
      body: JSON.stringify(samplePayload),
    })
    const { id: personId } = await createRes.json<{ id: string }>()
    const updateRes = await SELF.fetch(`http://example.com/api/persons/${personId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', Cookie: `${SESSION_COOKIE_NAME}=${editor.token}` },
      body: JSON.stringify({ ...samplePayload, hoTen: 'Nguyễn Văn B' }),
    })
    const { requestId } = await updateRes.json<{ requestId: string }>()
    await SELF.fetch(`http://example.com/api/requests/${requestId}/approve`, {
      method: 'POST', headers: { Cookie: `${SESSION_COOKIE_NAME}=${admin.token}` },
    })
    const db = drizzle(env.giapha_db)
    const row = await db.select().from(persons).where(eq(persons.id, personId)).get()
    expect(row?.name).toBe('Nguyễn Văn B')
  })

  it('approving a delete request removes the person', async () => {
    const editor = await tokenFor('editor')
    const admin = await tokenFor('admin')
    const createRes = await SELF.fetch('http://example.com/api/persons', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: `${SESSION_COOKIE_NAME}=${admin.token}` },
      body: JSON.stringify(samplePayload),
    })
    const { id: personId } = await createRes.json<{ id: string }>()
    const deleteRes = await SELF.fetch(`http://example.com/api/persons/${personId}`, {
      method: 'DELETE', headers: { Cookie: `${SESSION_COOKIE_NAME}=${editor.token}` },
    })
    const { requestId } = await deleteRes.json<{ requestId: string }>()
    await SELF.fetch(`http://example.com/api/requests/${requestId}/approve`, {
      method: 'POST', headers: { Cookie: `${SESSION_COOKIE_NAME}=${admin.token}` },
    })
    const db = drizzle(env.giapha_db)
    expect(await db.select().from(persons).where(eq(persons.id, personId)).get()).toBeUndefined()

    // The request row itself must survive (for audit), with its personId nulled out by
    // the FK's ON DELETE SET NULL rather than being cascade-deleted along with the person.
    const request = await db.select().from(editorRequests).where(eq(editorRequests.id, requestId)).get()
    expect(request?.status).toBe('approved')
    expect(request?.resolvedBy).toBe(admin.userId)
    expect(request?.personId).toBeNull()
  })
})

describe('POST /api/requests/:id/reject', () => {
  it('marks the request rejected without changing data', async () => {
    const editor = await tokenFor('editor')
    const admin = await tokenFor('admin')
    const createRes = await SELF.fetch('http://example.com/api/persons', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: `${SESSION_COOKIE_NAME}=${editor.token}` },
      body: JSON.stringify(samplePayload),
    })
    const { requestId } = await createRes.json<{ requestId: string }>()
    const res = await SELF.fetch(`http://example.com/api/requests/${requestId}/reject`, {
      method: 'POST', headers: { Cookie: `${SESSION_COOKIE_NAME}=${admin.token}` },
    })
    expect(res.status).toBe(200)
    const db = drizzle(env.giapha_db)
    expect(await db.select().from(persons).all()).toHaveLength(0)
    const request = await db.select().from(editorRequests).where(eq(editorRequests.id, requestId)).get()
    expect(request?.status).toBe('rejected')
  })
})
