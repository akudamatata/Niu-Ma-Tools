import { Hono } from 'hono'
import type { EnvBindings } from '../index'

interface LogPayload {
  level?: 'info' | 'error'
  message: string
  metadata?: Record<string, unknown>
}

export const apiRoute = new Hono<{ Bindings: EnvBindings }>()

apiRoute.get('/', (c) => c.json({ ok: true, name: c.env.APP_NAME }))

apiRoute.post('/log', async (c) => {
  const body = await c.req.json<LogPayload>().catch(() => null)

  if (!body?.message) {
    return c.json({ ok: false, error: 'Invalid log payload' }, 400)
  }

  if (c.env.LOGS) {
    const id = `${Date.now()}:${crypto.randomUUID()}`
    await c.env.LOGS.put(id, JSON.stringify({ ...body, ts: new Date().toISOString() }))
  }

  return c.json({ ok: true })
})

