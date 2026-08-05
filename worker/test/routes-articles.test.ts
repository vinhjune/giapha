import { describe, it, expect, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { drizzle } from 'drizzle-orm/d1'
import { env } from 'cloudflare:test'
import { eq } from 'drizzle-orm'
import { articles, users } from '../src/db/schema'
import { attachUser } from '../src/middleware/auth'
import articleRoutes from '../src/routes/articles'
import { createSession, SESSION_COOKIE_NAME } from '../src/lib/session'
import { hashPassword } from '../src/lib/password'
import type { HonoEnv } from '../src/types'

function buildApp() {
  const app = new Hono<HonoEnv>()
  app.use('*', attachUser)
  app.route('/api', articleRoutes)
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

async function createArticle(
  app: ReturnType<typeof buildApp>,
  token: string,
  body: {
    slug: string
    title?: string
    summary?: string
    body?: string
    categoryId?: string
    status?: 'draft' | 'published'
    displayOrder?: number
  },
) {
  const res = await app.request('/api/articles', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `${SESSION_COOKIE_NAME}=${token}`,
    },
    body: JSON.stringify({
      categoryId: 'cat-gioi-thieu',
      title: 'Bài viết mẫu',
      summary: 'Tóm tắt mẫu',
      body: 'Nội dung mẫu',
      ...body,
    }),
  }, env)

  expect(res.status).toBe(201)
  return res.json<{
    id: string
    slug: string
    title: string
    summary: string
    body: string
    categoryId: string
    status: 'draft' | 'published'
    displayOrder: number
    publishedAt: string | null
    coverImageKey: string | null
    authorId: string
  }>()
}

describe('GET /api/articles', () => {
  it('returns only published articles publicly', async () => {
    const app = buildApp()
    const { token } = await makeUser('editor')
    await createArticle(app, token, { slug: `draft-${crypto.randomUUID()}`, status: 'draft', displayOrder: 2 })
    const published = await createArticle(app, token, { slug: `published-${crypto.randomUUID()}`, status: 'published', displayOrder: 1 })

    const res = await app.request('/api/articles', undefined, env)

    expect(res.status).toBe(200)
    const body = await res.json<Array<{ id: string; slug: string; status: 'draft' | 'published' }>>()
    expect(body).toEqual([
      expect.objectContaining({ id: published.id, slug: published.slug, status: 'published' }),
    ])
  })
})

describe('GET /api/articles/all', () => {
  it('returns 401 without auth and returns both draft and published for an editor', async () => {
    const app = buildApp()
    const unauthRes = await app.request('/api/articles/all', undefined, env)
    expect(unauthRes.status).toBe(401)

    const { token } = await makeUser('editor')
    const draft = await createArticle(app, token, { slug: `draft-all-${crypto.randomUUID()}`, status: 'draft', displayOrder: 2 })
    const published = await createArticle(app, token, { slug: `published-all-${crypto.randomUUID()}`, status: 'published', displayOrder: 1 })

    const res = await app.request('/api/articles/all', {
      headers: { Cookie: `${SESSION_COOKIE_NAME}=${token}` },
    }, env)

    expect(res.status).toBe(200)
    const body = await res.json<Array<{ id: string; slug: string; status: 'draft' | 'published' }>>()
    expect(body).toEqual([
      expect.objectContaining({ id: published.id, slug: published.slug, status: 'published' }),
      expect.objectContaining({ id: draft.id, slug: draft.slug, status: 'draft' }),
    ])
  })
})

describe('POST /api/articles', () => {
  it('returns 400 when required fields are missing', async () => {
    const app = buildApp()
    const { token } = await makeUser('admin')

    const res = await app.request('/api/articles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `${SESSION_COOKIE_NAME}=${token}` },
      body: JSON.stringify({
        slug: '',
        categoryId: 'cat-gioi-thieu',
        title: 'Thiếu slug',
        summary: 'Tóm tắt',
        body: 'Nội dung',
      }),
    }, env)

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Thiếu slug, chuyên mục, tiêu đề, tóm tắt hoặc nội dung bài viết' })
  })

  it('returns 400 for an unknown categoryId', async () => {
    const app = buildApp()
    const { token } = await makeUser('admin')

    const res = await app.request('/api/articles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `${SESSION_COOKIE_NAME}=${token}` },
      body: JSON.stringify({
        slug: `unknown-category-${crypto.randomUUID()}`,
        categoryId: 'cat-khong-ton-tai',
        title: 'Sai chuyên mục',
        summary: 'Tóm tắt',
        body: 'Nội dung',
      }),
    }, env)

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Chuyên mục không tồn tại' })
  })

  it('returns 409 for a duplicate slug', async () => {
    const app = buildApp()
    const { token } = await makeUser('admin')
    const slug = `duplicate-${crypto.randomUUID()}`
    await createArticle(app, token, { slug })

    const res = await app.request('/api/articles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `${SESSION_COOKIE_NAME}=${token}` },
      body: JSON.stringify({
        slug,
        categoryId: 'cat-gioi-thieu',
        title: 'Trùng slug',
        summary: 'Tóm tắt',
        body: 'Nội dung',
      }),
    }, env)

    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'Slug bài viết đã tồn tại' })
  })

  it('returns 400 for an invalid status value', async () => {
    const app = buildApp()
    const { token } = await makeUser('admin')

    const res = await app.request('/api/articles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `${SESSION_COOKIE_NAME}=${token}` },
      body: JSON.stringify({
        slug: `invalid-status-${crypto.randomUUID()}`,
        categoryId: 'cat-gioi-thieu',
        title: 'Sai trạng thái',
        summary: 'Tóm tắt',
        body: 'Nội dung',
        status: 'archived',
      }),
    }, env)

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Trạng thái bài viết không hợp lệ' })
  })
})

describe('PUT /api/articles/:id', () => {
  it('returns 404 when the article does not exist', async () => {
    const app = buildApp()
    const { token } = await makeUser('editor')

    const res = await app.request(`/api/articles/${crypto.randomUUID()}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: `${SESSION_COOKIE_NAME}=${token}` },
      body: JSON.stringify({ title: 'Không tồn tại' }),
    }, env)

    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'Không tìm thấy bài viết' })
  })

  it('returns 400 when updating to an unknown categoryId', async () => {
    const app = buildApp()
    const { token } = await makeUser('editor')
    const article = await createArticle(app, token, { slug: `unknown-update-category-${crypto.randomUUID()}` })

    const res = await app.request(`/api/articles/${article.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: `${SESSION_COOKIE_NAME}=${token}` },
      body: JSON.stringify({ categoryId: 'cat-khong-ton-tai' }),
    }, env)

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Chuyên mục không tồn tại' })
  })

  it('returns 409 when changing to a duplicate slug', async () => {
    const app = buildApp()
    const { token } = await makeUser('editor')
    const original = await createArticle(app, token, { slug: `original-${crypto.randomUUID()}` })
    const duplicate = await createArticle(app, token, { slug: `duplicate-target-${crypto.randomUUID()}` })

    const res = await app.request(`/api/articles/${duplicate.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: `${SESSION_COOKIE_NAME}=${token}` },
      body: JSON.stringify({ slug: original.slug }),
    }, env)

    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'Slug bài viết đã tồn tại' })
  })

  it('sets publishedAt when changing a draft to published', async () => {
    const app = buildApp()
    const { token } = await makeUser('editor')
    const article = await createArticle(app, token, { slug: `publish-once-${crypto.randomUUID()}`, status: 'draft' })

    const res = await app.request(`/api/articles/${article.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: `${SESSION_COOKIE_NAME}=${token}` },
      body: JSON.stringify({ status: 'published' }),
    }, env)

    expect(res.status).toBe(200)
    const body = await res.json<{ status: 'draft' | 'published'; publishedAt: string | null }>()
    expect(body.status).toBe('published')
    expect(body.publishedAt).toEqual(expect.any(String))
  })

  it('keeps the original publishedAt when updating an already published article', async () => {
    const app = buildApp()
    const { token } = await makeUser('editor')
    const article = await createArticle(app, token, { slug: `publish-twice-${crypto.randomUUID()}`, status: 'draft' })

    const firstPublishRes = await app.request(`/api/articles/${article.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: `${SESSION_COOKIE_NAME}=${token}` },
      body: JSON.stringify({ status: 'published' }),
    }, env)
    const firstPublish = await firstPublishRes.json<{ publishedAt: string }>()

    const secondPublishRes = await app.request(`/api/articles/${article.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: `${SESSION_COOKIE_NAME}=${token}` },
      body: JSON.stringify({ title: 'Đổi tiêu đề sau khi xuất bản' }),
    }, env)

    expect(secondPublishRes.status).toBe(200)
    const secondPublish = await secondPublishRes.json<{ publishedAt: string; title: string }>()
    expect(secondPublish.title).toBe('Đổi tiêu đề sau khi xuất bản')
    expect(secondPublish.publishedAt).toBe(firstPublish.publishedAt)
  })

  it('returns 400 for an invalid status value', async () => {
    const app = buildApp()
    const { token } = await makeUser('editor')
    const article = await createArticle(app, token, { slug: `invalid-status-update-${crypto.randomUUID()}` })

    const res = await app.request(`/api/articles/${article.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: `${SESSION_COOKIE_NAME}=${token}` },
      body: JSON.stringify({ status: 'archived' }),
    }, env)

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Trạng thái bài viết không hợp lệ' })
  })
})

describe('DELETE /api/articles/:id', () => {
  it('returns 404 when the article does not exist', async () => {
    const app = buildApp()
    const { token } = await makeUser('admin')

    const res = await app.request(`/api/articles/${crypto.randomUUID()}`, {
      method: 'DELETE',
      headers: { Cookie: `${SESSION_COOKIE_NAME}=${token}` },
    }, env)

    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'Không tìm thấy bài viết' })
  })

  it('removes the article', async () => {
    const app = buildApp()
    const { token } = await makeUser('admin')
    const article = await createArticle(app, token, { slug: `delete-${crypto.randomUUID()}` })

    const deleteRes = await app.request(`/api/articles/${article.id}`, {
      method: 'DELETE',
      headers: { Cookie: `${SESSION_COOKIE_NAME}=${token}` },
    }, env)

    expect(deleteRes.status).toBe(204)
    expect(await deleteRes.text()).toBe('')

    const db = drizzle(env.giapha_db)
    expect(await db.select().from(articles).where(eq(articles.id, article.id)).get()).toBeUndefined()
  })
})

describe('POST /api/articles/:id/cover', () => {
  it('uploads a cover image and stores coverImageKey', async () => {
    const app = buildApp()
    const { token } = await makeUser('editor')
    const article = await createArticle(app, token, { slug: `cover-${crypto.randomUUID()}` })
    const formData = new FormData()
    formData.set('file', new File([new Blob(['hello cover'])], 'cover.png', { type: 'image/png' }))

    const res = await app.request(`/api/articles/${article.id}/cover`, {
      method: 'POST',
      headers: { Cookie: `${SESSION_COOKIE_NAME}=${token}` },
      body: formData,
    }, env)

    expect(res.status).toBe(200)
    const body = await res.json<{ id: string; coverImageKey: string | null }>()
    expect(body.id).toBe(article.id)
    expect(body.coverImageKey).toBe(`article-covers/${article.id}.png`)
  })
})
