import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { resolve, join } from 'node:path'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'

const appName = process.env.APP_NAME ?? 'Niu Ma Tools'
const port = Number.parseInt(process.env.PORT ?? '8787', 10)
const staticRoot = resolve(process.env.STATIC_ROOT ?? 'dist')
const logDir = process.env.LOG_DIR ?? '/data/logs'

const app = new Hono()

app.use('*', cors())
app.use('/assets/*', serveStatic({ root: staticRoot }))
app.use('/favicon.ico', serveStatic({ root: staticRoot, path: 'favicon.ico' }))

app.get('/api', (c) => c.json({ ok: true, name: appName }))

app.post('/api/log', async (c) => {
  let payload

  try {
    payload = await c.req.json()
  } catch (error) {
    console.error('Failed to parse log payload', error)
    return c.json({ ok: false, error: 'Invalid log payload' }, 400)
  }

  if (!payload || typeof payload.message !== 'string' || payload.message.trim().length === 0) {
    return c.json({ ok: false, error: 'Invalid log payload' }, 400)
  }

  const logEntry = {
    level: payload.level ?? 'info',
    message: payload.message,
    metadata: payload.metadata ?? null,
    ts: new Date().toISOString()
  }

  try {
    if (!existsSync(logDir)) {
      await mkdir(logDir, { recursive: true })
    }

    const fileName = `${Date.now()}-${randomUUID()}.json`
    const filePath = join(logDir, fileName)
    await writeFile(filePath, JSON.stringify(logEntry, null, 2), 'utf8')
  } catch (error) {
    console.error('Failed to persist log entry', error)
    return c.json({ ok: false, error: 'Failed to persist log entry' }, 500)
  }

  return c.json({ ok: true })
})

app.get('*', async (c) => {
  try {
    const html = await readFile(join(staticRoot, 'index.html'), 'utf8')
    return c.html(html)
  } catch (error) {
    console.error('Failed to load application UI', error)
    return c.text('Application UI is not built. Run "npm run build" first.', 500)
  }
})

console.log(`Starting Niu Ma Tools server on port ${port}`)

serve({
  fetch: app.fetch,
  port
})
