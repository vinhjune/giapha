import { describe, it, expect } from 'vitest'
import { SELF } from 'cloudflare:test'

describe('GET /api/health', () => {
  it('returns ok: true', async () => {
    const res = await SELF.fetch('http://example.com/api/health')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })
})
