import { describe, it, expect } from 'vitest'
import { drizzle } from 'drizzle-orm/d1'
import { env } from 'cloudflare:test'
import { users } from '../src/db/schema'
import { createSession, getSessionUser, deleteSession, SESSION_COOKIE_NAME } from '../src/lib/session'

describe('session helpers', () => {
  async function makeUser() {
    const db = drizzle(env.giapha_db)
    const id = crypto.randomUUID()
    await db.insert(users).values({ id, username: `u-${id}`, passwordHash: 'x', role: 'admin', email: `${id}@example.com` })
    return id
  }

  it('creates a session and resolves the user from its token', async () => {
    const db = drizzle(env.giapha_db)
    const userId = await makeUser()
    const token = await createSession(db, userId)
    expect(typeof token).toBe('string')
    expect(token.length).toBeGreaterThan(20)
    const user = await getSessionUser(db, token)
    expect(user?.id).toBe(userId)
  })

  it('returns null for an unknown token', async () => {
    const db = drizzle(env.giapha_db)
    const user = await getSessionUser(db, 'not-a-real-token')
    expect(user).toBeNull()
  })

  it('returns null for an expired session', async () => {
    const db = drizzle(env.giapha_db)
    const userId = await makeUser()
    const token = await createSession(db, userId, -1000)
    const user = await getSessionUser(db, token)
    expect(user).toBeNull()
  })

  it('deleteSession removes the session so lookups return null afterward', async () => {
    const db = drizzle(env.giapha_db)
    const userId = await makeUser()
    const token = await createSession(db, userId)
    await deleteSession(db, token)
    const user = await getSessionUser(db, token)
    expect(user).toBeNull()
  })

  it('exports a stable cookie name', () => {
    expect(SESSION_COOKIE_NAME).toBe('giapha_session')
  })
})
