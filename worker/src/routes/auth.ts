import { Hono, type Context } from 'hono'
import { setCookie, deleteCookie, getCookie } from 'hono/cookie'
import { drizzle } from 'drizzle-orm/d1'
import { eq, or, count } from 'drizzle-orm'
import { users } from '../db/schema'
import { hashPassword, verifyPassword, generateRandomPassword } from '../lib/password'
import { createSession, deleteSession, deleteAllSessionsForUser, SESSION_COOKIE_NAME, SESSION_DURATION_MS } from '../lib/session'
import { sendMail as defaultSendMail } from '../lib/mailer'
import type { HonoEnv } from '../types'
import type { DB } from '../lib/reshape'

// Minimum time between two "forgot password" requests for the same account.
const PASSWORD_RESET_COOLDOWN_MS = 5 * 60 * 1000

function setSessionCookie(c: Context<HonoEnv>, token: string) {
  // Only mark the cookie Secure when the request actually arrived over HTTPS. Forcing
  // Secure unconditionally breaks local dev over plain http (wrangler dev / vite proxy)
  // in some browser configurations that don't treat http://localhost as a trustworthy
  // origin, silently dropping the cookie and making every authenticated request look
  // logged-out even right after a successful login.
  const isHttps = new URL(c.req.url).protocol === 'https:'
  setCookie(c, SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isHttps,
    sameSite: 'Lax',
    path: '/',
    maxAge: SESSION_DURATION_MS / 1000,
  })
}

/**
 * Builds the auth routes. Accepts `sendMail` as an injectable dependency (defaulting to the
 * real Gmail-SMTP implementation) so tests can supply a stub without needing to reach the
 * network — the Cloudflare Workers vitest pool runs each test's worker in an isolate where
 * `vi.mock` on worker-side modules is not reliable.
 */
export function createAuthRoutes(sendMail: typeof defaultSendMail = defaultSendMail) {
  const authRoutes = new Hono<HonoEnv>()

  authRoutes.get('/auth/me', async (c) => {
    const db = drizzle(c.env.giapha_db) as DB
    const [{ total }] = await db.select({ total: count() }).from(users)
    const user = c.get('user')
    return c.json({ user, setupNeeded: total === 0 })
  })

  authRoutes.post('/auth/setup', async (c) => {
    const db = drizzle(c.env.giapha_db) as DB
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
    const db = drizzle(c.env.giapha_db) as DB
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
    const db = drizzle(c.env.giapha_db) as DB
    const token = getCookie(c, SESSION_COOKIE_NAME)
    if (token) await deleteSession(db, token)
    deleteCookie(c, SESSION_COOKIE_NAME, { path: '/' })
    return c.json({ ok: true })
  })

  authRoutes.post('/auth/forgot-password', async (c) => {
    const db = drizzle(c.env.giapha_db) as DB
    const body = await c.req.json<{ email: string }>()
    const email = body.email?.trim()
    // Generic response for all outcomes (unknown email, rate-limited, or success) to avoid
    // leaking which email addresses have an account.
    const genericResponse = { ok: true, message: 'Nếu email tồn tại trong hệ thống, mật khẩu mới đã được gửi tới email đó.' }
    if (!email) return c.json(genericResponse)

    const row = await db.select().from(users).where(eq(users.email, email)).get()
    if (!row || !row.isActive) return c.json(genericResponse)

    if (row.passwordResetRequestedAt) {
      const elapsed = Date.now() - new Date(row.passwordResetRequestedAt).getTime()
      if (elapsed < PASSWORD_RESET_COOLDOWN_MS) return c.json(genericResponse)
    }

    const newPassword = generateRandomPassword()
    const passwordHash = await hashPassword(newPassword)
    await db.update(users)
      .set({ passwordHash, passwordResetRequestedAt: new Date().toISOString() })
      .where(eq(users.id, row.id))
    await deleteAllSessionsForUser(db, row.id)

    try {
      await sendMail(
        c.env,
        row.email,
        'Mật khẩu mới cho Gia phả họ Hoàng',
        `Chào ${row.username},\n\nMật khẩu mới của bạn là: ${newPassword}\n\nVui lòng đăng nhập và đổi mật khẩu sau khi truy cập.\n\nNếu bạn không yêu cầu điều này, vui lòng liên hệ quản trị viên ngay.`,
      )
    } catch (err) {
      // The password was already reset; surface the failure via logs rather than the response,
      // since the response must stay generic. An admin can investigate mailer/SMTP config.
      console.error('forgot-password: failed to send email', err)
    }

    return c.json(genericResponse)
  })

  return authRoutes
}

export default createAuthRoutes()
