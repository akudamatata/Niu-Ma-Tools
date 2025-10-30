import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { Fetcher } from '@cloudflare/workers-types'
import { homeRoute } from './routes/home'
import { apiRoute } from './routes/api'
import { staticRoute } from './routes/static'

export interface EnvBindings {
  APP_NAME: string
  __STATIC_CONTENT: KVNamespace
  __STATIC_CONTENT_MANIFEST: string
  ASSETS?: Fetcher
  LOGS?: KVNamespace
  R2?: R2Bucket
  AI?: unknown
}

const app = new Hono<{ Bindings: EnvBindings }>()

app.use('*', cors())

app.route('/', homeRoute)
app.route('/api', apiRoute)
app.route('/', staticRoute)

export default app
