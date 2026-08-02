import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useAuthStore } from './useAuthStore'
import * as api from '../services/api'

vi.mock('../services/api')

const sampleUser = { id: '1', username: 'admin', email: 'a@example.com', role: 'admin' as const, personId: null }

beforeEach(() => {
  useAuthStore.setState({ user: null, setupNeeded: false, loading: false, error: null })
  vi.clearAllMocks()
})

describe('useAuthStore', () => {
  it('checkAuth populates user and setupNeeded from the API', async () => {
    vi.mocked(api.getAuthMe).mockResolvedValue({ user: sampleUser, setupNeeded: false })
    await useAuthStore.getState().checkAuth()
    expect(useAuthStore.getState().user).toEqual(sampleUser)
    expect(useAuthStore.getState().setupNeeded).toBe(false)
  })

  it('login sets the user on success', async () => {
    vi.mocked(api.login).mockResolvedValue({ user: sampleUser })
    await useAuthStore.getState().login('admin', 'secret')
    expect(useAuthStore.getState().user).toEqual(sampleUser)
    expect(useAuthStore.getState().error).toBeNull()
  })

  it('login sets an error message and leaves user null on failure', async () => {
    vi.mocked(api.login).mockRejectedValue(new Error('Sai tên đăng nhập hoặc mật khẩu'))
    await useAuthStore.getState().login('admin', 'wrong')
    expect(useAuthStore.getState().user).toBeNull()
    expect(useAuthStore.getState().error).toBe('Sai tên đăng nhập hoặc mật khẩu')
  })

  it('setupFirstAdmin sets the user on success', async () => {
    vi.mocked(api.setupFirstAdmin).mockResolvedValue({ user: sampleUser })
    await useAuthStore.getState().setupFirstAdmin('admin', 'secret', 'a@example.com')
    expect(useAuthStore.getState().user).toEqual(sampleUser)
  })

  it('logout clears the user', async () => {
    useAuthStore.setState({ user: sampleUser })
    vi.mocked(api.logout).mockResolvedValue({ ok: true })
    await useAuthStore.getState().logout()
    expect(useAuthStore.getState().user).toBeNull()
  })
})
