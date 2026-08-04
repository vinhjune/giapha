import { describe, it, expect, beforeEach } from 'vitest'
import { drizzle } from 'drizzle-orm/d1'
import { env, SELF } from 'cloudflare:test'
import { users, persons, editorRequests } from '../src/db/schema'
import { eq } from 'drizzle-orm'
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
  await db.insert(users).values({ id, username: `u-${id}`, passwordHash: 'x', role, email: `${id}@example.com` })
  return { userId: id, token: await createSession(db, id) }
}

const samplePayload = {
  hoTen: 'Nguyễn Văn A', gioiTinh: 'nam' as const, laThanhVienHo: true, honNhan: [],
}

describe('POST /api/persons authorization + request flow', () => {
  it('rejects anonymous requests with 401', async () => {
    const res = await SELF.fetch('http://example.com/api/persons', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(samplePayload),
    })
    expect(res.status).toBe(401)
  })

  it('admin creates the person directly', async () => {
    const { token } = await tokenFor('admin')
    const res = await SELF.fetch('http://example.com/api/persons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `${SESSION_COOKIE_NAME}=${token}` },
      body: JSON.stringify(samplePayload),
    })
    expect(res.status).toBe(201)
    const db = drizzle(env.giapha_db)
    const rows = await db.select().from(persons).all()
    expect(rows).toHaveLength(1)
    const requests = await db.select().from(editorRequests).all()
    expect(requests).toHaveLength(0)
  })

  it('editor creates an editor_requests row instead of a person', async () => {
    const { token, userId } = await tokenFor('editor')
    const res = await SELF.fetch('http://example.com/api/persons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `${SESSION_COOKIE_NAME}=${token}` },
      body: JSON.stringify(samplePayload),
    })
    expect(res.status).toBe(202)
    const body = await res.json<{ requestId: string }>()
    expect(body.requestId).toBeTruthy()

    const db = drizzle(env.giapha_db)
    expect(await db.select().from(persons).all()).toHaveLength(0)
    const requests = await db.select().from(editorRequests).all()
    expect(requests).toHaveLength(1)
    expect(requests[0]).toMatchObject({ type: 'create', personId: null, submittedBy: userId, status: 'pending' })
    expect(JSON.parse(requests[0].payload!)).toMatchObject({ hoTen: 'Nguyễn Văn A' })
  })
})

describe('PUT /api/persons/:id authorization + request flow', () => {
  it('editor update creates a pending request tied to the person', async () => {
    const { token: adminToken } = await tokenFor('admin')
    const createRes = await SELF.fetch('http://example.com/api/persons', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: `${SESSION_COOKIE_NAME}=${adminToken}` },
      body: JSON.stringify(samplePayload),
    })
    const { id: personId } = await createRes.json<{ id: string }>()

    const { token: editorToken } = await tokenFor('editor')
    const res = await SELF.fetch(`http://example.com/api/persons/${personId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', Cookie: `${SESSION_COOKIE_NAME}=${editorToken}` },
      body: JSON.stringify({ ...samplePayload, hoTen: 'Nguyễn Văn B' }),
    })
    expect(res.status).toBe(202)
    const db = drizzle(env.giapha_db)
    const unchanged = await db.select().from(persons).where(eq(persons.id, personId)).get()
    expect(unchanged?.name).toBe('Nguyễn Văn A')
    const requests = await db.select().from(editorRequests).all()
    expect(requests[0]).toMatchObject({ type: 'update', personId, status: 'pending' })
  })

  it('rejects a second pending edit request for the same person with 409', async () => {
    const { token: adminToken } = await tokenFor('admin')
    const createRes = await SELF.fetch('http://example.com/api/persons', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: `${SESSION_COOKIE_NAME}=${adminToken}` },
      body: JSON.stringify(samplePayload),
    })
    const { id: personId } = await createRes.json<{ id: string }>()
    const { token: editorToken } = await tokenFor('editor')
    await SELF.fetch(`http://example.com/api/persons/${personId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', Cookie: `${SESSION_COOKIE_NAME}=${editorToken}` },
      body: JSON.stringify(samplePayload),
    })
    const secondRes = await SELF.fetch(`http://example.com/api/persons/${personId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', Cookie: `${SESSION_COOKIE_NAME}=${editorToken}` },
      body: JSON.stringify(samplePayload),
    })
    expect(secondRes.status).toBe(409)
  })
})

describe('DELETE /api/persons/:id authorization + request flow', () => {
  it('editor delete creates a pending request; person still exists', async () => {
    const { token: adminToken } = await tokenFor('admin')
    const createRes = await SELF.fetch('http://example.com/api/persons', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: `${SESSION_COOKIE_NAME}=${adminToken}` },
      body: JSON.stringify(samplePayload),
    })
    const { id: personId } = await createRes.json<{ id: string }>()
    const { token: editorToken } = await tokenFor('editor')
    const res = await SELF.fetch(`http://example.com/api/persons/${personId}`, {
      method: 'DELETE', headers: { Cookie: `${SESSION_COOKIE_NAME}=${editorToken}` },
    })
    expect(res.status).toBe(202)
    const db = drizzle(env.giapha_db)
    expect(await db.select().from(persons).where(eq(persons.id, personId)).get()).toBeTruthy()
    const requests = await db.select().from(editorRequests).all()
    expect(requests[0]).toMatchObject({ type: 'delete', personId, payload: null, status: 'pending' })
  })
})
