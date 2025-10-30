import mime from 'mime'
import manifestJSON from '__STATIC_CONTENT_MANIFEST'
import type { Context } from 'hono'
import type { EnvBindings } from '../index'

type ManifestMap = Record<string, string>

const manifest: ManifestMap = manifestJSON ? JSON.parse(manifestJSON) : {}

function resolveAssetMapping(path: string) {
  const normalized = path.replace(/^\/+/, '') || 'index.html'
  return {
    normalized,
    assetKey: manifest[normalized] ?? normalized
  }
}

function ensureCachingHeaders(headers: Headers, fallbackType: string) {
  if (!headers.has('Cache-Control')) {
    headers.set('Cache-Control', 'public, max-age=3600')
  }

  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', fallbackType)
  }
}

export async function serveStaticAsset(
  c: Context<{ Bindings: EnvBindings }>,
  path: string,
  contentType?: string
) {
  const { normalized, assetKey } = resolveAssetMapping(path)
  const fallbackType = contentType ?? mime.getType(normalized) ?? 'application/octet-stream'

  if (c.env.__STATIC_CONTENT) {
    const content = await c.env.__STATIC_CONTENT.get(assetKey, 'arrayBuffer')
    if (content) {
      const headers = new Headers({
        'Cache-Control': 'public, max-age=3600',
        'Content-Type': fallbackType
      })

      return new Response(content, {
        status: 200,
        headers
      })
    }
  }

  if (c.env.ASSETS) {
    const assetUrl = new URL(assetKey, 'https://static.invalid/')
    const assetResponse = await c.env.ASSETS.fetch(assetUrl.toString())

    if (assetResponse.ok || assetResponse.status !== 404) {
      const assetBuffer = await assetResponse.arrayBuffer()
      const headers = new Headers()
      assetResponse.headers.forEach((value, key) => {
        headers.set(key, value)
      })

      if (assetResponse.ok) {
        ensureCachingHeaders(headers, fallbackType)
      }

      return new Response(assetBuffer, {
        status: assetResponse.status,
        headers
      })
    }
  }

  return c.notFound()
}
