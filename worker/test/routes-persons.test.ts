import { describe, it, expect, beforeEach } from 'vitest'
import { drizzle } from 'drizzle-orm/d1'
import { env, SELF } from 'cloudflare:test'
import { eq } from 'drizzle-orm'
import { users, persons } from '../src/db/schema'
import { createSession, SESSION_COOKIE_NAME } from '../src/lib/session'

// Editors and admins both write to /api/persons directly — there is no
// approval workflow (an editor-request-approval queue existed previously and
// was removed per user request; see git history if it needs to come back).

beforeEach(async () => {
  const db = drizzle(env.giapha_db)
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

describe('POST /api/persons', () => {
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
    expect(await db.select().from(persons).all()).toHaveLength(1)
  })

  it('editor creates the person directly (no approval needed)', async () => {
    const { token } = await tokenFor('editor')
    const res = await SELF.fetch('http://example.com/api/persons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `${SESSION_COOKIE_NAME}=${token}` },
      body: JSON.stringify(samplePayload),
    })
    expect(res.status).toBe(201)
    const body = await res.json<{ id: string }>()
    expect(body.id).toBeTruthy()
    const db = drizzle(env.giapha_db)
    const rows = await db.select().from(persons).all()
    expect(rows).toHaveLength(1)
    expect(rows[0].name).toBe('Nguyễn Văn A')
  })

  it('rejects a viewer with 403', async () => {
    const { token } = await tokenFor('viewer')
    const res = await SELF.fetch('http://example.com/api/persons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `${SESSION_COOKIE_NAME}=${token}` },
      body: JSON.stringify(samplePayload),
    })
    expect(res.status).toBe(403)
  })
})

describe('PUT /api/persons/:id', () => {
  it('editor updates the person directly (no approval needed)', async () => {
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
    expect(res.status).toBe(200)
    const db = drizzle(env.giapha_db)
    const updated = await db.select().from(persons).where(eq(persons.id, personId)).get()
    expect(updated?.name).toBe('Nguyễn Văn B')
  })
})

describe('DELETE /api/persons/:id', () => {
  it('editor deletes the person directly (no approval needed)', async () => {
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
    expect(res.status).toBe(200)
    const db = drizzle(env.giapha_db)
    expect(await db.select().from(persons).where(eq(persons.id, personId)).get()).toBeUndefined()
  })
})
