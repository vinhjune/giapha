import { describe, it, expect, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { drizzle } from 'drizzle-orm/d1'
import { env } from 'cloudflare:test'
import { eq } from 'drizzle-orm'
import { articleCategories, articles, users } from '../src/db/schema'
import { attachUser } from '../src/middleware/auth'
import articleCategoryRoutes from '../src/routes/article-categories'
import { createSession, SESSION_COOKIE_NAME } from '../src/lib/session'
import { hashPassword } from '../src/lib/password'
import type { HonoEnv } from '../src/types'

function buildApp() {
  const app = new Hono<HonoEnv>()
  app.use('*', attachUser)
  app.route('/api', articleCategoryRoutes)
  return app
}

beforeEach(async () => {
  const db = drizzle(env.giapha_db)
  await db.delete(articles)
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

describe('GET /api/article-categories', () => {
  it('returns seeded categories publicly with articleCount', async () => {
    const app = buildApp()
    const res = await app.request('/api/article-categories', undefined, env)
    expect(res.status).toBe(200)
    const body = await res.json<Array<{ slug: string; name: string; articleCount: number }>>()
    expect(body.length).toBeGreaterThanOrEqual(3)
    expect(body).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'cat-gioi-thieu', slug: 'gioi-thieu-dong-ho', name: 'Giới thiệu dòng họ', articleCount: expect.any(Number) }),
      expect.objectContaining({ id: 'cat-quy-uoc', slug: 'quy-uoc-trong-ho', name: 'Quy ước trong họ', articleCount: expect.any(Number) }),
      expect.objectContaining({ id: 'cat-hieu-hoc', slug: 'truyen-thong-hieu-hoc', name: 'Truyền thống hiếu học', articleCount: expect.any(Number) }),
    ]))
  })
})

describe('POST /api/article-categories', () => {
  it('returns 401 without auth', async () => {
    const app = buildApp()
    const res = await app.request('/api/article-categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: 'khong-auth', name: 'Không auth' }),
    }, env)
    expect(res.status).toBe(401)
  })

  it('returns 403 for a viewer role user', async () => {
    const app = buildApp()
    const { token } = await makeUser('viewer')
    const res = await app.request('/api/article-categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `${SESSION_COOKIE_NAME}=${token}` },
      body: JSON.stringify({ slug: 'viewer-bi-chan', name: 'Viewer bị chặn' }),
    }, env)
    expect(res.status).toBe(403)
  })

  it('creates a category successfully as admin', async () => {
    const app = buildApp()
    const { token } = await makeUser('admin')
    const slug = `cat-moi-${crypto.randomUUID()}`
    const res = await app.request('/api/article-categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `${SESSION_COOKIE_NAME}=${token}` },
      body: JSON.stringify({ slug, name: 'Chuyên mục mới', displayOrder: 12 }),
    }, env)
    expect(res.status).toBe(201)
    const body = await res.json<{ slug: string; name: string; displayOrder: number }>()
    expect(body).toMatchObject({ slug, name: 'Chuyên mục mới', displayOrder: 12 })
  })

  it('returns 409 for a duplicate slug', async () => {
    const app = buildApp()
    const { token } = await makeUser('admin')
    const res = await app.request('/api/article-categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `${SESSION_COOKIE_NAME}=${token}` },
      body: JSON.stringify({ slug: 'gioi-thieu-dong-ho', name: 'Trùng slug' }),
    }, env)
    expect(res.status).toBe(409)
  })
})

describe('PUT /api/article-categories/:id', () => {
  it('updates a category as editor', async () => {
    const app = buildApp()
    const db = drizzle(env.giapha_db)
    const id = crypto.randomUUID()
    await db.insert(articleCategories).values({
      id,
      slug: `cat-cap-nhat-${id}`,
      name: 'Tên cũ',
      displayOrder: 1,
    })

    const { token } = await makeUser('editor')
    const res = await app.request(`/api/article-categories/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: `${SESSION_COOKIE_NAME}=${token}` },
      body: JSON.stringify({ slug: `cat-da-cap-nhat-${id}`, name: 'Tên mới', displayOrder: 8 }),
    }, env)
    expect(res.status).toBe(200)
    const body = await res.json<{ slug: string; name: string; displayOrder: number }>()
    expect(body).toMatchObject({ slug: `cat-da-cap-nhat-${id}`, name: 'Tên mới', displayOrder: 8 })
  })
})

describe('DELETE /api/article-categories/:id', () => {
  it('returns 409 when the category has articles', async () => {
    const app = buildApp()
    const db = drizzle(env.giapha_db)
    const categoryId = crypto.randomUUID()
    const authorId = crypto.randomUUID()
    await db.insert(users).values({
      id: authorId,
      username: `author-${authorId}`,
      passwordHash: await hashPassword('x'),
      role: 'editor',
      email: `author-${authorId}@example.com`,
    })
    await db.insert(articleCategories).values({
      id: categoryId,
      slug: `cat-co-bai-${categoryId}`,
      name: 'Có bài viết',
      displayOrder: 3,
    })
    await db.insert(articles).values({
      id: crypto.randomUUID(),
      slug: `bai-viet-${categoryId}`,
      categoryId,
      title: 'Bài viết đang dùng',
      summary: 'Tóm tắt',
      body: 'Nội dung',
      authorId,
      status: 'draft',
      displayOrder: 0,
    })

    const { token } = await makeUser('admin')
    const res = await app.request(`/api/article-categories/${categoryId}`, {
      method: 'DELETE',
      headers: { Cookie: `${SESSION_COOKIE_NAME}=${token}` },
    }, env)
    expect(res.status).toBe(409)
  })

  it('succeeds with 204 when the category has no articles', async () => {
    const app = buildApp()
    const db = drizzle(env.giapha_db)
    const id = crypto.randomUUID()
    await db.insert(articleCategories).values({
      id,
      slug: `cat-rong-${id}`,
      name: 'Không có bài viết',
      displayOrder: 4,
    })

    const { token } = await makeUser('admin')
    const res = await app.request(`/api/article-categories/${id}`, {
      method: 'DELETE',
      headers: { Cookie: `${SESSION_COOKIE_NAME}=${token}` },
    }, env)
    expect(res.status).toBe(204)
    expect(await res.text()).toBe('')
    expect(await db.select().from(articleCategories).where(eq(articleCategories.id, id)).get()).toBeUndefined()
  })
})
