import { Hono, type Context } from 'hono'
import { setCookie, deleteCookie, getCookie } from 'hono/cookie'
import { drizzle } from 'drizzle-orm/d1'
import { eq, or, count } from 'drizzle-orm'
import { users } from '../db/schema'
import { hashPassword, verifyPassword } from '../lib/password'
import { createSession, deleteSession, SESSION_COOKIE_NAME, SESSION_DURATION_MS } from '../lib/session'
import type { HonoEnv } from '../types'

const authRoutes = new Hono<HonoEnv>()

function setSessionCookie(c: Context<HonoEnv>, token: string) {
  setCookie(c, SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: SESSION_DURATION_MS / 1000,
  })
}

authRoutes.get('/auth/me', async (c) => {
  const db = drizzle(c.env.giapha_db)
  const [{ total }] = await db.select({ total: count() }).from(users)
  const user = c.get('user')
  return c.json({ user, setupNeeded: total === 0 })
})

authRoutes.post('/auth/setup', async (c) => {
  const db = drizzle(c.env.giapha_db)
  const [{ total }] = await db.select({ total: count() }).from(users)
  if (total > 0) return c.json({ error: 'Hệ thống đã có người quản trị' }, 409)

  const body = await c.req.json<{ username: string; password: string; email: string }>()
  if (!body.username?.trim() || !body.password || !body.email?.trim()) {
    return c.json({ error: 'Thiếu username, password hoặc email' }, 400)
  }
  const id = crypto.randomUUID()
  const passwordHash = await hashPassword(body.password)
  await db.insert(users).values({ id, username: body.username.trim(), passwordHash, role: 'admin', email: body.email.trim() })
  const token = await createSession(db, id)
  setSessionCookie(c, token)
  return c.json({ user: { id, username: body.username.trim(), role: 'admin', email: body.email.trim(), personId: null } }, 201)
})

authRoutes.post('/auth/login', async (c) => {
  const db = drizzle(c.env.giapha_db)
  const body = await c.req.json<{ username: string; password: string }>()
  const identifier = body.username ?? ''
  // Accepts either username or email in the same field, per spec ("username-hoặc-email + password").
  const row = await db.select().from(users)
    .where(or(eq(users.username, identifier), eq(users.email, identifier)))
    .get()
  if (!row || !row.isActive || !(await verifyPassword(body.password ?? '', row.passwordHash))) {
    return c.json({ error: 'Sai tên đăng nhập hoặc mật khẩu' }, 401)
  }
  const token = await createSession(db, row.id)
  setSessionCookie(c, token)
  return c.json({ user: { id: row.id, username: row.username, role: row.role, email: row.email, personId: row.personId } })
})

authRoutes.post('/auth/logout', async (c) => {
  const db = drizzle(c.env.giapha_db)
  const token = getCookie(c, SESSION_COOKIE_NAME)
  if (token) await deleteSession(db, token)
  deleteCookie(c, SESSION_COOKIE_NAME, { path: '/' })
  return c.json({ ok: true })
})

export default authRoutes
