import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { resolve, join, extname } from 'node:path'
import { tmpdir } from 'node:os'
import { spawn } from 'node:child_process'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'

const appName = process.env.APP_NAME ?? 'Niu Ma Tools'
const port = Number.parseInt(process.env.PORT ?? '8787', 10)
const staticRoot = resolve(process.env.STATIC_ROOT ?? 'dist')
const logDir = process.env.LOG_DIR ?? '/data/logs'
const tempRoot = tmpdir()

function normalizeBitrate(value) {
  if (!value) {
    return null
  }

  const normalized = String(value).trim().toLowerCase()

  if (/^(?:96|128|160|192|224|256|320)k$/.test(normalized)) {
    return normalized
  }

  return null
}

function sanitizeFilename(name, fallback = 'converted') {
  const base = name?.trim() ? name.trim() : fallback
  return base.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '_')
}

function encodeFilenameHeader(name) {
  const sanitized = name.replace(/"/g, "'")
  const encoded = encodeURIComponent(name)
  return `attachment; filename="${sanitized}"; filename*=UTF-8''${encoded}`
}

function runFFmpeg(inputPath, outputPath, bitrate) {
  return new Promise((resolvePromise, rejectPromise) => {
    const args = ['-y', '-i', inputPath, '-b:a', bitrate, outputPath]
    const ffmpegProcess = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] })

    let errorOutput = ''

    ffmpegProcess.stderr.on('data', (chunk) => {
      errorOutput += chunk.toString()
    })

    ffmpegProcess.on('error', (error) => {
      rejectPromise(error)
    })

    ffmpegProcess.on('close', (code) => {
      if (code === 0) {
        resolvePromise()
      } else {
        rejectPromise(new Error(`FFmpeg exited with code ${code}: ${errorOutput}`))
      }
    })
  })
}

async function cleanupTempFiles(...paths) {
  await Promise.all(
    paths.map(async (path) => {
      if (!path) return

      try {
        await unlink(path)
      } catch (error) {
        if (error && error.code !== 'ENOENT') {
          console.warn('Failed to cleanup temp file', path, error)
        }
      }
    })
  )
}

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

app.post('/api/convert', async (c) => {
  let formData

  try {
    formData = await c.req.formData()
  } catch (error) {
    console.error('Failed to parse convert form data', error)
    return c.json({ ok: false, error: '请求数据格式不正确。' }, 400)
  }

  const file = formData.get('file')
  const bitrateValue = formData.get('bitrate') ?? '192k'
  const bitrate = normalizeBitrate(bitrateValue)

  if (!(file instanceof File)) {
    return c.json({ ok: false, error: '未提供有效的音频文件。' }, 400)
  }

  if (!bitrate) {
    return c.json({ ok: false, error: '比特率参数无效。' }, 400)
  }

  const originalName = file.name || 'audio'
  const id = randomUUID()
  const inputExt = extname(originalName) || '.tmp'
  const safeBaseName = sanitizeFilename(originalName.replace(/\.[^/.]+$/, ''), 'converted')
  const outputFileName = `${safeBaseName}-niu-ma.mp3`
  const inputPath = join(tempRoot, `${id}-input${inputExt}`)
  const outputPath = join(tempRoot, `${id}-output.mp3`)

  let outputBuffer = null

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(inputPath, buffer)
    await runFFmpeg(inputPath, outputPath, bitrate)
    outputBuffer = await readFile(outputPath)
  } catch (error) {
    console.error('Failed to convert audio file', error)
    await cleanupTempFiles(inputPath, outputPath)
    return c.json({ ok: false, error: '音频转换失败，请稍后重试。', detail: error?.message ?? String(error) }, 500)
  }

  await cleanupTempFiles(inputPath, outputPath)

  if (!outputBuffer) {
    return c.json({ ok: false, error: '音频转换失败，请稍后重试。' }, 500)
  }

  const headers = {
    'Content-Type': 'audio/mpeg',
    'Content-Length': String(outputBuffer.length),
    'Content-Disposition': encodeFilenameHeader(outputFileName),
    'X-Converted-Filename': encodeURIComponent(outputFileName),
    'X-Original-Filename': encodeURIComponent(originalName)
  }

  return c.body(outputBuffer, 200, headers)
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
