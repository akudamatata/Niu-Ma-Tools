import { Hono } from 'hono'
import type { EnvBindings } from '../index'
import { serveStaticAsset } from '../utils/response'

export const homeRoute = new Hono<{ Bindings: EnvBindings }>()

homeRoute.get('/', (c) => serveStaticAsset(c, 'index.html', 'text/html; charset=utf-8'))
homeRoute.get('/tools/*', (c) => serveStaticAsset(c, 'index.html', 'text/html; charset=utf-8'))

