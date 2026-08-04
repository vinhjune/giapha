import type { GiaphaData, Person, AuthUser, EditorRequest, ManagedUser, MutationResult } from '../types/giapha'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init)
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.error || `Request failed: ${res.status}`)
  }
  return res.json()
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
