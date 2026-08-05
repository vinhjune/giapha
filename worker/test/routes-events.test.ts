import { describe, it, expect, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { drizzle } from 'drizzle-orm/d1'
import { env } from 'cloudflare:test'
import { events, users } from '../src/db/schema'
import { attachUser } from '../src/middleware/auth'
import eventRoutes from '../src/routes/events'
import { createSession, SESSION_COOKIE_NAME } from '../src/lib/session'
import { hashPassword } from '../src/lib/password'
import type { HonoEnv } from '../src/types'

function buildApp() {
  const app = new Hono<HonoEnv>()
  app.use('*', attachUser)
  app.route('/api', eventRoutes)
  return app
}

beforeEach(async () => {
  const db = drizzle(env.giapha_db)
  await db.delete(events)
  await db.delete(users)
})

async function makeUser(role: 'admin' | 'editor' | 'viewer') {
  const db = drizzle(env.giapha_db)
  const id = crypto.randomUUID()
  await db.insert(users).values({
    id,
    username: `${role}-${id}`,
    passwordHash: await hashPassword('x'),
    role,
    email: `${role}-${id}@example.com`,
  })
  return { userId: id, token: await createSession(db, id) }
}

async function createEvent(
  app: ReturnType<typeof buildApp>,
  token: string,
  body: {
    title?: string
    description?: string | null
    dateText?: string | null
    year?: number | null
    month?: number | null
    day?: number | null
    isLunar?: boolean
    isRecurring?: boolean
  },
) {
  const res = await app.request('/api/events', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `${SESSION_COOKIE_NAME}=${token}`,
    },
    body: JSON.stringify({
      title: 'Giỗ cụ tổ',
      description: 'Sửa soạn hương hoa',
      dateText: 'Mùng 10 tháng 3',
      month: 3,
      day: 10,
      ...body,
    }),
  }, env)

  expect(res.status).toBe(201)
  return res.json<{
    id: string
    title: string
    description: string | null
    dateText: string | null
    year: number | null
    month: number | null
    day: number | null
    isLunar: boolean
    isRecurring: boolean
  }>()
}

describe('GET /api/events', () => {
  it('is public and returns an empty array initially', async () => {
    const app = buildApp()

    const res = await app.request('/api/events', undefined, env)

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
  })
})

describe('POST /api/events', () => {
  it('returns 401 without auth', async () => {
    const app = buildApp()

    const res = await app.request('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Giỗ đầu năm' }),
    }, env)

    expect(res.status).toBe(401)
  })

  it('creates an event as editor with schema-aligned default booleans', async () => {
    const app = buildApp()
    const { token } = await makeUser('editor')

    const res = await app.request('/api/events', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `${SESSION_COOKIE_NAME}=${token}`,
      },
      body: JSON.stringify({
        title: 'Giỗ tổ họ',
        description: 'Tập trung tại nhà thờ họ',
        dateText: 'Rằm tháng 7',
        month: 7,
        day: 15,
      }),
    }, env)

    expect(res.status).toBe(201)
    expect(await res.json()).toMatchObject({
      title: 'Giỗ tổ họ',
      description: 'Tập trung tại nhà thờ họ',
      dateText: 'Rằm tháng 7',
      year: null,
      month: 7,
      day: 15,
      isLunar: false,
      isRecurring: true,
    })
  })

  it('returns 400 when title is missing', async () => {
    const app = buildApp()
    const { token } = await makeUser('admin')

    const res = await app.request('/api/events', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `${SESSION_COOKIE_NAME}=${token}`,
      },
      body: JSON.stringify({ description: 'Thiếu tiêu đề' }),
    }, env)

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Thiếu tiêu đề sự kiện' })
  })
})

describe('PUT /api/events/:id', () => {
  it('updates an event title as admin', async () => {
    const app = buildApp()
    const { token } = await makeUser('admin')
    const event = await createEvent(app, token, {})

    const res = await app.request(`/api/events/${event.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `${SESSION_COOKIE_NAME}=${token}`,
      },
      body: JSON.stringify({ title: 'Giỗ cụ tổ đã cập nhật' }),
    }, env)

    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({
      id: event.id,
      title: 'Giỗ cụ tổ đã cập nhật',
    })
  })
})

describe('DELETE /api/events/:id', () => {
  it('removes the event and it no longer appears in GET /api/events', async () => {
    const app = buildApp()
    const { token } = await makeUser('editor')
    const event = await createEvent(app, token, {})

    const deleteRes = await app.request(`/api/events/${event.id}`, {
      method: 'DELETE',
      headers: { Cookie: `${SESSION_COOKIE_NAME}=${token}` },
    }, env)

    expect(deleteRes.status).toBe(204)
    expect(await deleteRes.text()).toBe('')

    const listRes = await app.request('/api/events', undefined, env)
    expect(listRes.status).toBe(200)
    expect(await listRes.json()).toEqual([])
  })
})
