import { describe, it, expect } from 'vitest'
import { drizzle } from 'drizzle-orm/d1'
import { eq } from 'drizzle-orm'
import { env } from 'cloudflare:test'
import { users, sessions, editorRequests } from '../src/db/schema'

describe('auth schema', () => {
  it('users table accepts admin role and email', async () => {
    const db = drizzle(env.giapha_db)
    const id = crypto.randomUUID()
    await db.insert(users).values({
      id, username: 'admin1', passwordHash: 'x', role: 'admin', email: 'a@example.com',
    })
    const row = await db.select().from(users).where(eq(users.id, id)).get()
    expect(row?.role).toBe('admin')
    expect(row?.email).toBe('a@example.com')
  })

  it('sessions table links to users with cascade delete', async () => {
    const db = drizzle(env.giapha_db)
    const userId = crypto.randomUUID()
    await db.insert(users).values({ id: userId, username: 'admin2', passwordHash: 'x', role: 'admin', email: 'b@example.com' })
    await db.insert(sessions).values({ token: 'tok123', userId, expiresAt: new Date(Date.now() + 1000).toISOString() })
    const before = await db.select().from(sessions).all()
    expect(before).toHaveLength(1)
    await db.delete(users).where(eq(users.id, userId))
    const after = await db.select().from(sessions).all()
    expect(after).toHaveLength(0)
  })

  it('editorRequests table stores a pending create request', async () => {
    const db = drizzle(env.giapha_db)
    const userId = crypto.randomUUID()
    await db.insert(users).values({ id: userId, username: 'editor1', passwordHash: 'x', role: 'editor', email: 'e@example.com' })
    await db.insert(editorRequests).values({
      id: crypto.randomUUID(), type: 'create', personId: null,
      payload: JSON.stringify({ hoTen: 'Test' }), status: 'pending', submittedBy: userId,
    })
    const rows = await db.select().from(editorRequests).all()
    expect(rows).toHaveLength(1)
    expect(rows[0].status).toBe('pending')
  })
})
