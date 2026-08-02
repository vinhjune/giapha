import { describe, it, expect, beforeEach } from 'vitest'
import { drizzle } from 'drizzle-orm/d1'
import { env, SELF } from 'cloudflare:test'
import { persons, editorRequests, users } from '../src/db/schema'

beforeEach(async () => {
  const db = drizzle(env.giapha_db)
  await db.delete(editorRequests)
  await db.delete(persons)
  await db.delete(users)
})

describe('GET /api/tree pendingRequestId', () => {
  it('omits pendingRequestId when there is no pending request', async () => {
    const db = drizzle(env.giapha_db)
    const id = crypto.randomUUID()
    await db.insert(persons).values({ id, name: 'A', gender: 'male', isAlive: true, ngoaiToc: false })
    const res = await SELF.fetch('http://example.com/api/tree')
    const body = await res.json<{ persons: Record<string, { pendingRequestId?: string }> }>()
    expect(body.persons[id].pendingRequestId).toBeUndefined()
  })

  it('includes pendingRequestId for a person with a pending update request', async () => {
    const db = drizzle(env.giapha_db)
    const personId = crypto.randomUUID()
    await db.insert(persons).values({ id: personId, name: 'A', gender: 'male', isAlive: true, ngoaiToc: false })
    const submitterId = crypto.randomUUID()
    await db.insert(users).values({ id: submitterId, username: `u-${submitterId}`, passwordHash: 'x', role: 'editor', email: 'e@example.com' })
    const requestId = crypto.randomUUID()
    await db.insert(editorRequests).values({
      id: requestId, type: 'update', personId, payload: '{}', submittedBy: submitterId, status: 'pending',
    })
    const res = await SELF.fetch('http://example.com/api/tree')
    const body = await res.json<{ persons: Record<string, { pendingRequestId?: string }> }>()
    expect(body.persons[personId].pendingRequestId).toBe(requestId)
  })

  it('does not include an approved request', async () => {
    const db = drizzle(env.giapha_db)
    const personId = crypto.randomUUID()
    await db.insert(persons).values({ id: personId, name: 'A', gender: 'male', isAlive: true, ngoaiToc: false })
    const submitterId = crypto.randomUUID()
    await db.insert(users).values({ id: submitterId, username: `u-${submitterId}`, passwordHash: 'x', role: 'editor', email: 'e@example.com' })
    await db.insert(editorRequests).values({
      id: crypto.randomUUID(), type: 'update', personId, payload: '{}', submittedBy: submitterId, status: 'approved',
    })
    const res = await SELF.fetch('http://example.com/api/tree')
    const body = await res.json<{ persons: Record<string, { pendingRequestId?: string }> }>()
    expect(body.persons[personId].pendingRequestId).toBeUndefined()
  })
})
