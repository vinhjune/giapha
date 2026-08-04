import { describe, it, expect, beforeEach } from 'vitest'
import { drizzle } from 'drizzle-orm/d1'
import { env, SELF } from 'cloudflare:test'
import { eq } from 'drizzle-orm'
import { users } from '../src/db/schema'
import { createSession, SESSION_COOKIE_NAME } from '../src/lib/session'
import { hashPassword } from '../src/lib/password'

beforeEach(async () => {
  const db = drizzle(env.giapha_db)
  await db.delete(users)
})

async function makeAdmin() {
  const db = drizzle(env.giapha_db)
  const id = crypto.randomUUID()
  await db.insert(users).values({ id, username: 'root-admin', passwordHash: await hashPassword('x'), role: 'admin', email: 'a@example.com' })
  return { userId: id, token: await createSession(db, id) }
}

async function makeEditorToken() {
  const db = drizzle(env.giapha_db)
  const id = crypto.randomUUID()
  await db.insert(users).values({ id, username: 'ed', passwordHash: 'x', role: 'editor', email: 'e@example.com' })
  return createSession(db, id)
}

describe('GET /api/users', () => {
  it('rejects non-admin with 403', async () => {
    const token = await makeEditorToken()
    const res = await SELF.fetch('http://example.com/api/users', { headers: { Cookie: `${SESSION_COOKIE_NAME}=${token}` } })
    expect(res.status).toBe(403)
  })

  it('admin lists users without exposing passwordHash', async () => {
    const { token } = await makeAdmin()
    const res = await SELF.fetch('http://example.com/api/users', { headers: { Cookie: `${SESSION_COOKIE_NAME}=${token}` } })
    const body = await res.json<{ users: Record<string, unknown>[] }>()
    expect(body.users).toHaveLength(1)
    expect(body.users[0]).not.toHaveProperty('passwordHash')
  })
})

describe('POST /api/users', () => {
  it('admin creates an editor user', async () => {
    const { token } = await makeAdmin()
    const res = await SELF.fetch('http://example.com/api/users', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: `${SESSION_COOKIE_NAME}=${token}` },
      body: JSON.stringify({ username: 'editor1', password: 'password123', role: 'editor', email: 'ed1@example.com' }),
    })
    expect(res.status).toBe(201)
    const body = await res.json<{ user: { username: string; role: string } }>()
    expect(body.user).toMatchObject({ username: 'editor1', role: 'editor' })
    expect(body.user).not.toHaveProperty('passwordHash')
  })

  it('rejects a duplicate username with 409', async () => {
    const { token } = await makeAdmin()
    await SELF.fetch('http://example.com/api/users', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: `${SESSION_COOKIE_NAME}=${token}` },
      body: JSON.stringify({ username: 'dup', password: 'password123', role: 'editor', email: 'dup1@example.com' }),
    })
    const res = await SELF.fetch('http://example.com/api/users', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: `${SESSION_COOKIE_NAME}=${token}` },
      body: JSON.stringify({ username: 'dup', password: 'password123', role: 'editor', email: 'dup2@example.com' }),
    })
    expect(res.status).toBe(409)
  })

  it('rejects a duplicate email with 409', async () => {
    const { token } = await makeAdmin()
    await SELF.fetch('http://example.com/api/users', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: `${SESSION_COOKIE_NAME}=${token}` },
      body: JSON.stringify({ username: 'first-user', password: 'password123', role: 'editor', email: 'dup@example.com' }),
    })
    const res = await SELF.fetch('http://example.com/api/users', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: `${SESSION_COOKIE_NAME}=${token}` },
      body: JSON.stringify({ username: 'second-user', password: 'password123', role: 'editor', email: 'dup@example.com' }),
    })
    expect(res.status).toBe(409)
  })
})

describe('PUT /api/users/:id', () => {
  it('admin updates a user role', async () => {
    const { token } = await makeAdmin()
    const createRes = await SELF.fetch('http://example.com/api/users', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: `${SESSION_COOKIE_NAME}=${token}` },
      body: JSON.stringify({ username: 'promote-me', password: 'password123', role: 'editor', email: 'p@example.com' }),
    })
    const { user } = await createRes.json<{ user: { id: string } }>()
    const res = await SELF.fetch(`http://example.com/api/users/${user.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', Cookie: `${SESSION_COOKIE_NAME}=${token}` },
      body: JSON.stringify({ role: 'admin' }),
    })
    expect(res.status).toBe(200)
    const db = drizzle(env.giapha_db)
    const row = await db.select().from(users).where(eq(users.id, user.id)).get()
    expect(row?.role).toBe('admin')
  })

  it('rejects demoting the last remaining admin with 409', async () => {
    const { token, userId } = await makeAdmin()
    const res = await SELF.fetch(`http://example.com/api/users/${userId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', Cookie: `${SESSION_COOKIE_NAME}=${token}` },
      body: JSON.stringify({ role: 'editor' }),
    })
    expect(res.status).toBe(409)
  })

  it('admin edits username, email and password for an existing user', async () => {
    const { token } = await makeAdmin()
    const createRes = await SELF.fetch('http://example.com/api/users', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: `${SESSION_COOKIE_NAME}=${token}` },
      body: JSON.stringify({ username: 'edit-me', password: 'password123', role: 'editor', email: 'edit-me@example.com' }),
    })
    const { user } = await createRes.json<{ user: { id: string } }>()

    const res = await SELF.fetch(`http://example.com/api/users/${user.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', Cookie: `${SESSION_COOKIE_NAME}=${token}` },
      body: JSON.stringify({ username: 'edited-name', email: 'edited@example.com', password: 'newpassword123' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json<{ user: { username: string; email: string } }>()
    expect(body.user).toMatchObject({ username: 'edited-name', email: 'edited@example.com' })
    expect(body.user).not.toHaveProperty('passwordHash')

    const db = drizzle(env.giapha_db)
    const row = await db.select().from(users).where(eq(users.id, user.id)).get()
    expect(row?.username).toBe('edited-name')
    expect(row?.email).toBe('edited@example.com')
    expect(row?.passwordHash).not.toBe('') // hash was actually replaced
  })

  it('rejects renaming a user to a username already taken by someone else with 409', async () => {
    const { token } = await makeAdmin()
    await SELF.fetch('http://example.com/api/users', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: `${SESSION_COOKIE_NAME}=${token}` },
      body: JSON.stringify({ username: 'taken-name', password: 'password123', role: 'editor', email: 'taken@example.com' }),
    })
    const createRes = await SELF.fetch('http://example.com/api/users', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: `${SESSION_COOKIE_NAME}=${token}` },
      body: JSON.stringify({ username: 'renamer', password: 'password123', role: 'editor', email: 'renamer@example.com' }),
    })
    const { user } = await createRes.json<{ user: { id: string } }>()

    const res = await SELF.fetch(`http://example.com/api/users/${user.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', Cookie: `${SESSION_COOKIE_NAME}=${token}` },
      body: JSON.stringify({ username: 'taken-name' }),
    })
    expect(res.status).toBe(409)
  })

  it('rejects updating a user email to one already taken by someone else with 409', async () => {
    const { token } = await makeAdmin()
    await SELF.fetch('http://example.com/api/users', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: `${SESSION_COOKIE_NAME}=${token}` },
      body: JSON.stringify({ username: 'owner', password: 'password123', role: 'editor', email: 'taken-email@example.com' }),
    })
    const createRes = await SELF.fetch('http://example.com/api/users', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: `${SESSION_COOKIE_NAME}=${token}` },
      body: JSON.stringify({ username: 'other', password: 'password123', role: 'editor', email: 'other@example.com' }),
    })
    const { user } = await createRes.json<{ user: { id: string } }>()

    const res = await SELF.fetch(`http://example.com/api/users/${user.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', Cookie: `${SESSION_COOKIE_NAME}=${token}` },
      body: JSON.stringify({ email: 'taken-email@example.com' }),
    })
    expect(res.status).toBe(409)
  })

  it('allows keeping the same username/email unchanged when editing other fields', async () => {
    const { token } = await makeAdmin()
    const createRes = await SELF.fetch('http://example.com/api/users', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: `${SESSION_COOKIE_NAME}=${token}` },
      body: JSON.stringify({ username: 'unchanged', password: 'password123', role: 'editor', email: 'unchanged@example.com' }),
    })
    const { user } = await createRes.json<{ user: { id: string } }>()

    const res = await SELF.fetch(`http://example.com/api/users/${user.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', Cookie: `${SESSION_COOKIE_NAME}=${token}` },
      body: JSON.stringify({ username: 'unchanged', email: 'unchanged@example.com', role: 'viewer' }),
    })
    expect(res.status).toBe(200)
  })
})

describe('DELETE /api/users/:id', () => {
  it('rejects deleting the last remaining admin with 409', async () => {
    const { token, userId } = await makeAdmin()
    const res = await SELF.fetch(`http://example.com/api/users/${userId}`, {
      method: 'DELETE', headers: { Cookie: `${SESSION_COOKIE_NAME}=${token}` },
    })
    expect(res.status).toBe(409)
  })

  it('deletes a non-last-admin user', async () => {
    const { token } = await makeAdmin()
    const createRes = await SELF.fetch('http://example.com/api/users', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: `${SESSION_COOKIE_NAME}=${token}` },
      body: JSON.stringify({ username: 'remove-me', password: 'password123', role: 'editor', email: 'r@example.com' }),
    })
    const { user } = await createRes.json<{ user: { id: string } }>()
    const res = await SELF.fetch(`http://example.com/api/users/${user.id}`, {
      method: 'DELETE', headers: { Cookie: `${SESSION_COOKIE_NAME}=${token}` },
    })
    expect(res.status).toBe(200)
    const db = drizzle(env.giapha_db)
    expect(await db.select().from(users).where(eq(users.id, user.id)).get()).toBeUndefined()
  })
})
