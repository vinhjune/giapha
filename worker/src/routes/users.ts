import { Hono } from 'hono'
import { drizzle } from 'drizzle-orm/d1'
import { eq, and, ne, count } from 'drizzle-orm'
import { users } from '../db/schema'
import { requireRole } from '../middleware/auth'
import { hashPassword } from '../lib/password'
import type { HonoEnv } from '../types'

const userRoutes = new Hono<HonoEnv>()

function toPublicUser(row: typeof users.$inferSelect) {
  const { passwordHash: _passwordHash, ...rest } = row
  return rest
}

async function countOtherAdmins(db: ReturnType<typeof drizzle>, excludeUserId: string): Promise<number> {
  const [{ total }] = await db.select({ total: count() }).from(users)
    .where(and(eq(users.role, 'admin'), ne(users.id, excludeUserId)))
  return total
}

userRoutes.get('/users', requireRole('admin'), async (c) => {
  const db = drizzle(c.env.giapha_db)
  const rows = await db.select().from(users).all()
  return c.json({ users: rows.map(toPublicUser) })
})

userRoutes.post('/users', requireRole('admin'), async (c) => {
  const db = drizzle(c.env.giapha_db)
  const body = await c.req.json<{ username: string; password: string; role: 'admin' | 'editor' | 'viewer'; email: string; personId?: string }>()
  if (!body.username?.trim() || !body.password || !body.email?.trim()) {
    return c.json({ error: 'Thiếu username, password hoặc email' }, 400)
  }
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.username, body.username.trim())).get()
  if (existing) return c.json({ error: 'Tên đăng nhập đã tồn tại' }, 409)

  const id = crypto.randomUUID()
  const passwordHash = await hashPassword(body.password)
  await db.insert(users).values({
    id, username: body.username.trim(), passwordHash, role: body.role,
    email: body.email.trim(), personId: body.personId ?? null,
  })
  const row = await db.select().from(users).where(eq(users.id, id)).get()
  return c.json({ user: toPublicUser(row!) }, 201)
})

userRoutes.put('/users/:id', requireRole('admin'), async (c) => {
  const db = drizzle(c.env.giapha_db)
  const id = c.req.param('id')
  const target = await db.select().from(users).where(eq(users.id, id)).get()
  if (!target) return c.json({ error: 'Không tìm thấy người dùng' }, 404)

  const body = await c.req.json<{ role?: 'admin' | 'editor' | 'viewer'; email?: string; personId?: string | null; isActive?: boolean; password?: string }>()

  if (body.role && body.role !== 'admin' && target.role === 'admin') {
    const otherAdmins = await countOtherAdmins(db, id)
    if (otherAdmins === 0) return c.json({ error: 'Không thể hạ quyền admin cuối cùng' }, 409)
  }

  const updates: Partial<typeof users.$inferInsert> = {}
  if (body.role !== undefined) updates.role = body.role
  if (body.email !== undefined) updates.email = body.email.trim()
  if (body.personId !== undefined) updates.personId = body.personId
  if (body.isActive !== undefined) updates.isActive = body.isActive
  if (body.password) updates.passwordHash = await hashPassword(body.password)

  await db.update(users).set(updates).where(eq(users.id, id))
  const row = await db.select().from(users).where(eq(users.id, id)).get()
  return c.json({ user: toPublicUser(row!) })
})

userRoutes.delete('/users/:id', requireRole('admin'), async (c) => {
  const db = drizzle(c.env.giapha_db)
  const id = c.req.param('id')
  const target = await db.select().from(users).where(eq(users.id, id)).get()
  if (!target) return c.json({ error: 'Không tìm thấy người dùng' }, 404)

  if (target.role === 'admin') {
    const otherAdmins = await countOtherAdmins(db, id)
    if (otherAdmins === 0) return c.json({ error: 'Không thể xóa admin cuối cùng' }, 409)
  }

  await db.delete(users).where(eq(users.id, id))
  return c.json({ ok: true })
})

export default userRoutes
