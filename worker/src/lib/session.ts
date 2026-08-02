import { eq, and, gt } from 'drizzle-orm'
import { sessions, users } from '../db/schema'
import type { DB } from './reshape'

export const SESSION_COOKIE_NAME = 'giapha_session'
export const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

export interface AuthUser {
  id: string
  username: string
  role: 'admin' | 'editor' | 'viewer'
  email: string
  personId: string | null
}

/** Creates a session row and returns the raw token. `durationMs` overridable for tests (e.g. negative = already expired). */
export async function createSession(db: DB, userId: string, durationMs: number = SESSION_DURATION_MS): Promise<string> {
  const token = crypto.randomUUID() + crypto.randomUUID()
  const expiresAt = new Date(Date.now() + durationMs).toISOString()
  await db.insert(sessions).values({ token, userId, expiresAt })
  return token
}

/** Resolves a session token to its user, or null if the token is missing/expired/unknown. */
export async function getSessionUser(db: DB, token: string): Promise<AuthUser | null> {
  const nowIso = new Date().toISOString()
  const row = await db
    .select({
      id: users.id, username: users.username, role: users.role,
      email: users.email, personId: users.personId,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.token, token), gt(sessions.expiresAt, nowIso)))
    .get()
  return row ?? null
}

export async function deleteSession(db: DB, token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.token, token))
}
