import type { GiaphaData, Person } from '../types/giapha'

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

export function createPerson(person: Omit<Person, 'id'>): Promise<{ id: string }> {
  return request('/api/persons', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(person),
  })
}

export function updatePerson(id: string, person: Omit<Person, 'id'>): Promise<{ ok: true }> {
  return request(`/api/persons/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(person),
  })
}

export function deletePerson(id: string): Promise<{ ok: true }> {
  return request(`/api/persons/${id}`, { method: 'DELETE' })
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
