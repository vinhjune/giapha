import { describe, it, expect, beforeEach } from 'vitest'
import { drizzle } from 'drizzle-orm/d1'
import { env, SELF } from 'cloudflare:test'
import { users } from '../src/db/schema'
import { createSession, SESSION_COOKIE_NAME } from '../src/lib/session'

beforeEach(async () => {
  const db = drizzle(env.giapha_db)
  await db.delete(users)
})

async function tokenFor(role: 'admin' | 'editor' | 'viewer') {
  const db = drizzle(env.giapha_db)
  const id = crypto.randomUUID()
  await db.insert(users).values({ id, username: `u-${id}`, passwordHash: 'x', role, email: `${id}@example.com` })
  return createSession(db, id)
}

describe('GET /api/export/csv authorization', () => {
  it('rejects anonymous requests with 401', async () => {
    const res = await SELF.fetch('http://example.com/api/export/csv')
    expect(res.status).toBe(401)
  })

  it('rejects editor requests with 403', async () => {
    const token = await tokenFor('editor')
    const res = await SELF.fetch('http://example.com/api/export/csv', { headers: { Cookie: `${SESSION_COOKIE_NAME}=${token}` } })
    expect(res.status).toBe(403)
  })

  it('allows admin requests', async () => {
    const token = await tokenFor('admin')
    const res = await SELF.fetch('http://example.com/api/export/csv', { headers: { Cookie: `${SESSION_COOKIE_NAME}=${token}` } })
    expect(res.status).toBe(200)
  })
})

describe('POST /api/import/csv authorization', () => {
  it('rejects editor requests with 403', async () => {
    const token = await tokenFor('editor')
    const formData = new FormData()
    formData.append('file', new Blob(['id,name\n']), 'test.csv')
    const res = await SELF.fetch('http://example.com/api/import/csv', {
      method: 'POST', headers: { Cookie: `${SESSION_COOKIE_NAME}=${token}` }, body: formData,
    })
    expect(res.status).toBe(403)
  })
})
