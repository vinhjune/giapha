import { describe, it, expect, beforeEach } from 'vitest'
import { drizzle } from 'drizzle-orm/d1'
import { env, SELF } from 'cloudflare:test'
import { users } from '../src/db/schema'

function extractSessionCookie(res: Response): string {
  const setCookie = res.headers.get('set-cookie') ?? ''
  const match = setCookie.match(/giapha_session=([^;]+)/)
  if (!match) throw new Error(`No session cookie in: ${setCookie}`)
  return match[1]
}

beforeEach(async () => {
  const db = drizzle(env.giapha_db)
  await db.delete(users)
})

describe('GET /api/auth/me', () => {
  it('reports setupNeeded: true when there are no users yet', async () => {
    const res = await SELF.fetch('http://example.com/api/auth/me')
    const body = await res.json<{ user: null; setupNeeded: boolean }>()
    expect(body).toEqual({ user: null, setupNeeded: true })
  })
})

describe('POST /api/auth/setup', () => {
  it('creates the first admin user and logs them in', async () => {
    const res = await SELF.fetch('http://example.com/api/auth/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'supersecret1', email: 'admin@example.com' }),
    })
    expect(res.status).toBe(201)
    const body = await res.json<{ user: { username: string; role: string } }>()
    expect(body.user).toMatchObject({ username: 'admin', role: 'admin' })
    expect(res.headers.get('set-cookie')).toMatch(/giapha_session=/)
  })

  it('rejects setup if a user already exists', async () => {
    await SELF.fetch('http://example.com/api/auth/setup', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'supersecret1', email: 'admin@example.com' }),
    })
    const res = await SELF.fetch('http://example.com/api/auth/setup', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin2', password: 'supersecret1', email: 'admin2@example.com' }),
    })
    expect(res.status).toBe(409)
  })
})

describe('POST /api/auth/login', () => {
  async function setupAdmin() {
    await SELF.fetch('http://example.com/api/auth/setup', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'supersecret1', email: 'admin@example.com' }),
    })
  }

  it('logs in with correct credentials', async () => {
    await setupAdmin()
    const res = await SELF.fetch('http://example.com/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'supersecret1' }),
    })
    expect(res.status).toBe(200)
    expect(res.headers.get('set-cookie')).toMatch(/giapha_session=/)
  })

  it('rejects incorrect password with 401', async () => {
    await setupAdmin()
    const res = await SELF.fetch('http://example.com/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'wrong' }),
    })
    expect(res.status).toBe(401)
  })

  it('rejects an unknown username with 401', async () => {
    await setupAdmin()
    const res = await SELF.fetch('http://example.com/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'no-such-user', password: 'supersecret1' }),
    })
    expect(res.status).toBe(401)
  })

  it('logs in using the email address in place of the username', async () => {
    await setupAdmin()
    const res = await SELF.fetch('http://example.com/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin@example.com', password: 'supersecret1' }),
    })
    expect(res.status).toBe(200)
  })
})

describe('POST /api/auth/logout', () => {
  it('clears the session so /auth/me returns user: null again', async () => {
    await SELF.fetch('http://example.com/api/auth/setup', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'supersecret1', email: 'admin@example.com' }),
    })
    const loginRes = await SELF.fetch('http://example.com/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'supersecret1' }),
    })
    const cookie = extractSessionCookie(loginRes)
    const meBefore = await SELF.fetch('http://example.com/api/auth/me', { headers: { Cookie: `giapha_session=${cookie}` } })
    expect((await meBefore.json<{ user: unknown }>()).user).not.toBeNull()

    await SELF.fetch('http://example.com/api/auth/logout', { method: 'POST', headers: { Cookie: `giapha_session=${cookie}` } })
    const meAfter = await SELF.fetch('http://example.com/api/auth/me', { headers: { Cookie: `giapha_session=${cookie}` } })
    expect((await meAfter.json<{ user: unknown }>()).user).toBeNull()
  })
})
