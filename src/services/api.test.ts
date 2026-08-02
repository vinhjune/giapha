import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as api from './api'

describe('api.ts auth/requests/users functions', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('getAuthMe calls GET /api/auth/me and returns the parsed body', async () => {
    const mockBody = { user: null, setupNeeded: true }
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(mockBody), { status: 200 }))
    const result = await api.getAuthMe()
    expect(fetch).toHaveBeenCalledWith('/api/auth/me', undefined)
    expect(result).toEqual(mockBody)
  })

  it('login posts credentials as JSON to /api/auth/login', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ user: { id: '1' } }), { status: 200 }))
    await api.login('admin', 'secret')
    expect(fetch).toHaveBeenCalledWith('/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: 'secret' }),
    })
  })

  it('createPerson resolves with a pending response for editors', async () => {
    const mockBody = { pending: true, requestId: 'req-1' }
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(mockBody), { status: 202 }))
    const result = await api.createPerson({} as never)
    expect(result).toEqual(mockBody)
  })

  it('listRequests calls GET /api/requests', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ requests: [] }), { status: 200 }))
    await api.listRequests()
    expect(fetch).toHaveBeenCalledWith('/api/requests', undefined)
  })

  it('approveRequest posts to /api/requests/:id/approve', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }))
    await api.approveRequest('req-1')
    expect(fetch).toHaveBeenCalledWith('/api/requests/req-1/approve', { method: 'POST' })
  })

  it('listUsers calls GET /api/users', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ users: [] }), { status: 200 }))
    await api.listUsers()
    expect(fetch).toHaveBeenCalledWith('/api/users', undefined)
  })
})
