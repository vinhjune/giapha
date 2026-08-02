import { describe, it, expect } from 'vitest'
import { Hono } from 'hono'
import { drizzle } from 'drizzle-orm/d1'
import { env } from 'cloudflare:test'
import { users } from '../src/db/schema'
import { createSession, SESSION_COOKIE_NAME } from '../src/lib/session'
import { attachUser, requireRole } from '../src/middleware/auth'
import type { HonoEnv } from '../src/types'

function buildApp() {
  const app = new Hono<HonoEnv>()
  app.use('*', attachUser)
  app.get('/whoami', (c) => c.json({ user: c.get('user') }))
  app.get('/admin-only', requireRole('admin'), (c) => c.json({ ok: true }))
  app.get('/editor-or-admin', requireRole('admin', 'editor'), (c) => c.json({ ok: true }))
  return app
}

async function makeUserAndToken(role: 'admin' | 'editor' | 'viewer') {
  const db = drizzle(env.giapha_db)
  const id = crypto.randomUUID()
  await db.insert(users).values({ id, username: `u-${id}`, passwordHash: 'x', role, email: 'a@example.com' })
  const token = await createSession(db, id)
  return token
}

describe('attachUser middleware', () => {
  it('sets user to null when there is no session cookie', async () => {
    const app = buildApp()
    const res = await app.request('/whoami', {}, env)
    expect(await res.json()).toEqual({ user: null })
  })

  it('resolves the user from a valid session cookie', async () => {
    const app = buildApp()
    const token = await makeUserAndToken('editor')
    const res = await app.request('/whoami', { headers: { Cookie: `${SESSION_COOKIE_NAME}=${token}` } }, env)
    const body = await res.json<{ user: { role: string } | null }>()
    expect(body.user?.role).toBe('editor')
  })
})

describe('requireRole middleware', () => {
  it('returns 401 for anonymous requests', async () => {
    const app = buildApp()
    const res = await app.request('/admin-only', {}, env)
    expect(res.status).toBe(401)
  })

  it('returns 403 for a logged-in user with the wrong role', async () => {
    const app = buildApp()
    const token = await makeUserAndToken('editor')
    const res = await app.request('/admin-only', { headers: { Cookie: `${SESSION_COOKIE_NAME}=${token}` } }, env)
    expect(res.status).toBe(403)
  })

  it('allows a user whose role matches one of the allowed roles', async () => {
    const app = buildApp()
    const token = await makeUserAndToken('editor')
    const res = await app.request('/editor-or-admin', { headers: { Cookie: `${SESSION_COOKIE_NAME}=${token}` } }, env)
    expect(res.status).toBe(200)
  })

  it('allows admin through an admin-only route', async () => {
    const app = buildApp()
    const token = await makeUserAndToken('admin')
    const res = await app.request('/admin-only', { headers: { Cookie: `${SESSION_COOKIE_NAME}=${token}` } }, env)
    expect(res.status).toBe(200)
  })
})
