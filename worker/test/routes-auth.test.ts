import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Hono } from 'hono'
import { drizzle } from 'drizzle-orm/d1'
import { env, SELF } from 'cloudflare:test'
import { users } from '../src/db/schema'
import { createAuthRoutes } from '../src/routes/auth'
import type { HonoEnv } from '../src/types'

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

describe('POST /api/auth/forgot-password', () => {
  const sendMail = vi.fn().mockResolvedValue(undefined)
  const app = new Hono<HonoEnv>()
  app.route('/api', createAuthRoutes(sendMail))

  async function setupAdmin() {
    await SELF.fetch('http://example.com/api/auth/setup', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'supersecret1', email: 'admin@example.com' }),
    })
  }

  beforeEach(() => {
    sendMail.mockClear()
  })

  it('generates a new password, emails it, and logs the user out everywhere for a known email', async () => {
    await setupAdmin()
    const loginRes = await SELF.fetch('http://example.com/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'supersecret1' }),
    })
    const cookie = extractSessionCookie(loginRes)

    const res = await app.request('/api/auth/forgot-password', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@example.com' }),
    }, env)
    expect(res.status).toBe(200)
    expect(sendMail).toHaveBeenCalledTimes(1)
    const [, toAddress, , bodyText] = sendMail.mock.calls[0]
    expect(toAddress).toBe('admin@example.com')
    expect(bodyText).toMatch(/Mật khẩu mới của bạn là: /)

    // Old session invalidated by the reset.
    const meAfterReset = await SELF.fetch('http://example.com/api/auth/me', { headers: { Cookie: `giapha_session=${cookie}` } })
    expect((await meAfterReset.json<{ user: unknown }>()).user).toBeNull()

    // Old password no longer works.
    const oldLoginRes = await SELF.fetch('http://example.com/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'supersecret1' }),
    })
    expect(oldLoginRes.status).toBe(401)
  })

  it('returns the same generic response for an unknown email, without sending mail', async () => {
    await setupAdmin()
    const res = await app.request('/api/auth/forgot-password', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'no-such-user@example.com' }),
    }, env)
    expect(res.status).toBe(200)
    const body = await res.json<{ ok: boolean }>()
    expect(body.ok).toBe(true)
    expect(sendMail).not.toHaveBeenCalled()
  })

  it('rate-limits a second request within the cooldown window', async () => {
    await setupAdmin()
    await app.request('/api/auth/forgot-password', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@example.com' }),
    }, env)
    expect(sendMail).toHaveBeenCalledTimes(1)

    await app.request('/api/auth/forgot-password', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@example.com' }),
    }, env)
    expect(sendMail).toHaveBeenCalledTimes(1)
  })
})
