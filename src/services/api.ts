import type { GiaphaData, Person, AuthUser, EditorRequest, ManagedUser, MutationResult, ArticleCategory, Article, EventItem } from '../types/giapha'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init)
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.error || `Request failed: ${res.status}`)
  }
  return res.json()
}

async function requestVoid(path: string, init?: RequestInit): Promise<void> {
  const res = await fetch(path, init)
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.error || `Request failed: ${res.status}`)
  }
}

export function getTree(): Promise<GiaphaData> {
  return request<GiaphaData>('/api/tree')
}

export function createPerson(person: Omit<Person, 'id'>): Promise<MutationResult> {
  return request<MutationResult>('/api/persons', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(person),
  })
}

export function updatePerson(id: string, person: Omit<Person, 'id'>): Promise<MutationResult> {
  return request<MutationResult>(`/api/persons/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(person),
  })
}

export function deletePerson(id: string): Promise<MutationResult> {
  return request<MutationResult>(`/api/persons/${id}`, { method: 'DELETE' })
}

export async function uploadAvatar(id: string, file: File): Promise<{ avatarUrl: string }> {
  const formData = new FormData()
  formData.append('file', file)
  return request(`/api/persons/${id}/avatar`, { method: 'POST', body: formData })
}

export async function exportCsv(): Promise<Blob> {
  const res = await fetch('/api/export/csv')
  if (!res.ok) throw new Error(`Export failed: ${res.status}`)
  return res.blob()
}

export async function importCsv(file: File): Promise<{ imported: { persons: number; families: number } }> {
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch('/api/import/csv', { method: 'POST', body: formData })
  const body = await res.json()
  if (!res.ok) throw new Error((body?.errors ?? ['Import failed']).join('; '))
  return body
}

// ─── Auth ──────────────────────────────────────────────────────────────────

export function getAuthMe(): Promise<{ user: AuthUser | null; setupNeeded: boolean }> {
  return request<{ user: AuthUser | null; setupNeeded: boolean }>('/api/auth/me')
}

export function login(username: string, password: string): Promise<{ user: AuthUser }> {
  return request<{ user: AuthUser }>('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
}

export function setupFirstAdmin(username: string, password: string, email: string): Promise<{ user: AuthUser }> {
  return request<{ user: AuthUser }>('/api/auth/setup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, email }),
  })
}

export function logout(): Promise<{ ok: true }> {
  return request<{ ok: true }>('/api/auth/logout', { method: 'POST' })
}

export function forgotPassword(email: string): Promise<{ ok: boolean; message: string }> {
  return request<{ ok: boolean; message: string }>('/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })
}

// ─── Editor requests ─────────────────────────────────────────────────────────

export function listRequests(): Promise<{ requests: EditorRequest[] }> {
  return request<{ requests: EditorRequest[] }>('/api/requests')
}

export function approveRequest(id: string): Promise<{ ok: true }> {
  return request<{ ok: true }>(`/api/requests/${id}/approve`, { method: 'POST' })
}

export function rejectRequest(id: string): Promise<{ ok: true }> {
  return request<{ ok: true }>(`/api/requests/${id}/reject`, { method: 'POST' })
}

// ─── User management (admin-only) ───────────────────────────────────────────

export function listUsers(): Promise<{ users: ManagedUser[] }> {
  return request<{ users: ManagedUser[] }>('/api/users')
}

export function createUser(input: { username: string; password: string; role: string; email: string; personId?: string }): Promise<{ user: ManagedUser }> {
  return request<{ user: ManagedUser }>('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export function updateUser(id: string, input: Partial<{ username: string; role: string; email: string; personId: string | null; isActive: boolean; password: string }>): Promise<{ user: ManagedUser }> {
  return request<{ user: ManagedUser }>(`/api/users/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export function deleteUser(id: string): Promise<{ ok: true }> {
  return request<{ ok: true }>(`/api/users/${id}`, { method: 'DELETE' })
}

// ─── Articles & categories (landing page CMS) ───────────────────────────────

export function listArticleCategories(): Promise<ArticleCategory[]> {
  return request<ArticleCategory[]>('/api/article-categories')
}

export function createArticleCategory(input: { slug: string; name: string; displayOrder?: number }): Promise<ArticleCategory> {
  return request<ArticleCategory>('/api/article-categories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export function updateArticleCategory(id: string, input: Partial<{ slug: string; name: string; displayOrder: number }>): Promise<ArticleCategory> {
  return request<ArticleCategory>(`/api/article-categories/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export function deleteArticleCategory(id: string): Promise<void> {
  return requestVoid(`/api/article-categories/${id}`, { method: 'DELETE' })
}

export function listArticles(): Promise<Article[]> {
  return request<Article[]>('/api/articles')
}

export function getArticleBySlug(slug: string): Promise<Article> {
  return request<Article>(`/api/articles/slug/${encodeURIComponent(slug)}`)
}

export function listAllArticles(): Promise<Article[]> {
  return request<Article[]>('/api/articles/all')
}

export function createArticle(input: {
  slug: string
  categoryId: string
  title: string
  summary: string
  body: string
  status?: 'draft' | 'published'
  displayOrder?: number
}): Promise<Article> {
  return request<Article>('/api/articles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export function updateArticle(id: string, input: Partial<{
  slug: string
  categoryId: string
  title: string
  summary: string
  body: string
  status: 'draft' | 'published'
  displayOrder: number
}>): Promise<Article> {
  return request<Article>(`/api/articles/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export function deleteArticle(id: string): Promise<void> {
  return requestVoid(`/api/articles/${id}`, { method: 'DELETE' })
}

export function uploadArticleCover(id: string, file: File): Promise<Article> {
  const formData = new FormData()
  formData.append('file', file)
  return request<Article>(`/api/articles/${id}/cover`, { method: 'POST', body: formData })
}

/** Uploads an image for inline use in a rich-text article body (not tied to any article id). */
export function uploadArticleImage(file: File): Promise<{ url: string }> {
  const formData = new FormData()
  formData.append('file', file)
  return request<{ url: string }>('/api/article-images', { method: 'POST', body: formData })
}

export function listEvents(): Promise<EventItem[]> {
  return request<EventItem[]>('/api/events')
}

export function createEvent(input: {
  title: string
  description?: string
  dateText?: string
  year?: number
  month?: number
  day?: number
  isLunar?: boolean
  isRecurring?: boolean
}): Promise<EventItem> {
  return request<EventItem>('/api/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export function updateEvent(id: string, input: Partial<{
  title: string
  description: string
  dateText: string
  year: number
  month: number
  day: number
  isLunar: boolean
  isRecurring: boolean
}>): Promise<EventItem> {
  return request<EventItem>(`/api/events/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export function deleteEvent(id: string): Promise<void> {
  return requestVoid(`/api/events/${id}`, { method: 'DELETE' })
}
