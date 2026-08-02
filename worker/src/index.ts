import { Hono } from 'hono'
import { logger } from 'hono/logger'
import treeRoutes from './routes/tree'
import editorRoutes from './routes/editor'
import csvRoutes from './routes/csv'
import authRoutes from './routes/auth'
import { attachUser } from './middleware/auth'
import type { HonoEnv } from './types'

const app = new Hono<HonoEnv>()

app.use('*', logger())
// No CORS middleware (API and frontend share the same Worker origin).
app.use('*', attachUser)

app.get('/api/health', (c) => c.json({ ok: true }))
app.route('/api', authRoutes)
app.route('/api', treeRoutes)
app.route('/api', editorRoutes)
app.route('/api', csvRoutes)

// Serve R2 avatars — public read, no auth required
app.get('/api/avatars/:key{.+}', async (c) => {
  const key = c.req.param('key')
  const obj = await c.env.giapha_avatars.get(key)
  if (!obj) return c.json({ error: 'Not found' }, 404)
  const headers = new Headers()
  obj.writeHttpMetadata(headers)
  headers.set('cache-control', 'public, max-age=86400')
  return new Response(obj.body, { headers })
})

export default app
