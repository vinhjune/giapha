import { createMiddleware } from 'hono/factory'
import { getCookie } from 'hono/cookie'
import { drizzle } from 'drizzle-orm/d1'
import { getSessionUser, SESSION_COOKIE_NAME, type AuthUser } from '../lib/session'
import type { HonoEnv } from '../types'
import type { DB } from '../lib/reshape'

/** Resolves the session cookie (if any) into `c.get('user')`, or sets it to null. Never blocks the request. */
export const attachUser = createMiddleware<HonoEnv>(async (c, next) => {
  const token = getCookie(c, SESSION_COOKIE_NAME)
  if (!token) {
    c.set('user', null)
    await next()
    return
  }
  const db = drizzle(c.env.giapha_db) as DB
  const user = await getSessionUser(db, token)
  c.set('user', user)
  await next()
})

/** Route guard: 401 if not logged in, 403 if logged in but role isn't in `allowedRoles`. */
export function requireRole(...allowedRoles: AuthUser['role'][]) {
  return createMiddleware<HonoEnv>(async (c, next) => {
    const user = c.get('user')
    if (!user) return c.json({ error: 'Cần đăng nhập' }, 401)
    if (!allowedRoles.includes(user.role)) return c.json({ error: 'Không có quyền truy cập' }, 403)
    await next()
  })
}
