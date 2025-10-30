import mime from 'mime'
import type { Context } from 'hono'
import type { EnvBindings } from '../index'

function normalizePath(path: string) {
  const cleaned = path.replace(/^\/+/, '')
  return cleaned.length > 0 ? cleaned : 'index.html'
}

export async function serveStaticAsset(
  c: Context<{ Bindings: EnvBindings }>,
  path: string,
  contentType?: string
) {
  const assetPath = normalizePath(path)
  const fallbackType = contentType ?? mime.getType(assetPath) ?? 'application/octet-stream'

  if (!c.env.ASSETS) {
    return c.notFound()
  }

  const requestUrl = new URL(assetPath, 'https://static.invalid/')
  const assetResponse = await c.env.ASSETS.fetch(requestUrl.toString(), {
    method: 'GET'
  })

  if (assetResponse.status === 404) {
    return c.notFound()
  }

  const headers = new Headers()
  assetResponse.headers.forEach((value, key) => {
    headers.set(key, value)
  })

  if (!headers.has('Cache-Control')) {
    headers.set('Cache-Control', 'public, max-age=3600')
  }

  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', fallbackType)
  }

  const body = await assetResponse.arrayBuffer()

  return new Response(body, {
    status: assetResponse.status,
    headers
  })
}
