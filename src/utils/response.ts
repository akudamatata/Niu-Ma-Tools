import mime from 'mime'
import type { EnvBindings } from '../index'
import type { Context } from 'hono'

let manifestCache: Record<string, string> | undefined

async function resolveAssetKey(env: EnvBindings, path: string) {
  if (!manifestCache) {
    manifestCache = env.__STATIC_CONTENT_MANIFEST
      ? JSON.parse(env.__STATIC_CONTENT_MANIFEST)
      : {}
  }

  const manifest = manifestCache!

  return manifest[path] ?? path
}

export async function serveStaticAsset(
  c: Context<{ Bindings: EnvBindings }>,
  path: string,
  contentType?: string
) {
  const normalizedPath = path.replace(/^\//, '') || 'index.html'
  const assetKey = await resolveAssetKey(c.env, normalizedPath)
  const content = await c.env.__STATIC_CONTENT.get(assetKey, 'arrayBuffer')

  if (!content) {
    return c.notFound()
  }

  const headers = new Headers()
  headers.set('Cache-Control', 'public, max-age=3600')
  headers.set('Content-Type', contentType ?? mime.getType(normalizedPath) ?? 'application/octet-stream')

  return new Response(content, {
    status: 200,
    headers
  })
}
