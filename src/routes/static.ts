import { Hono } from 'hono'
import type { EnvBindings } from '../index'
import { serveStaticAsset } from '../utils/response'

export const staticRoute = new Hono<{ Bindings: EnvBindings }>()

staticRoute.get('/assets/*', (c) => {
  const path = c.req.path.replace(/^\//, '')
  return serveStaticAsset(c, path)
})

staticRoute.get('/favicon.ico', (c) => serveStaticAsset(c, 'favicon.ico'))

