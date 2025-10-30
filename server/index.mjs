import express from 'express'
import cors from 'cors'
import multer from 'multer'
import ffmpegPath from 'ffmpeg-static'
import { spawn } from 'child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { tmpdir } from 'node:os'
import { resolve, join, extname } from 'node:path'

const appName = process.env.APP_NAME ?? 'Niu Ma Tools'
const port = Number.parseInt(process.env.PORT ?? '8787', 10)
const staticRoot = resolve(process.env.STATIC_ROOT ?? 'dist')
const logDir = process.env.LOG_DIR ?? '/data/logs'
const upload = multer({ storage: multer.memoryStorage() })

const mimeToExtension = {
  'audio/mpeg': '.mp3',
  'audio/mp3': '.mp3',
  'audio/wav': '.wav',
  'audio/x-wav': '.wav',
  'audio/ogg': '.ogg',
  'audio/webm': '.webm',
  'audio/mp4': '.m4a',
  'audio/m4a': '.m4a',
  'audio/x-m4a': '.m4a',
  'audio/aac': '.aac',
  'audio/flac': '.flac',
  'audio/x-flac': '.flac'
}

async function createTempInputFile(file) {
  const workingDir = await mkdtemp(join(tmpdir(), 'niu-ma-audio-'))

  const originalExt = extname(file.originalname || '').toLowerCase()
  const fallbackExt = mimeToExtension[file.mimetype] ?? ''
  const ext = originalExt || fallbackExt || '.tmp'
  const inputPath = join(workingDir, `input${ext}`)

  await writeFile(inputPath, file.buffer)

  const cleanup = async () => {
    try {
      await rm(workingDir, { recursive: true, force: true })
    } catch (error) {
      console.error('Failed to clean temporary working directory', error)
    }
  }

  return { inputPath, cleanup }
}

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

function normalizeQuality(value) {
  if (value === undefined || value === null) {
    return null
  }

  const quality = Number.parseInt(String(value).trim(), 10)
  if (Number.isNaN(quality)) {
    return null
  }

  if (quality >= 0 && quality <= 9) {
    return String(quality)
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

const app = express()

app.use(cors())
app.use(express.json())
app.use('/assets', express.static(join(staticRoot, 'assets')))
app.get('/favicon.ico', (_req, res, next) => {
  res.sendFile(join(staticRoot, 'favicon.ico'), (error) => {
    if (error) {
      next()
    }
  })
})

app.get('/api', (_req, res) => {
  res.json({ ok: true, name: appName })
})

app.post('/api/log', async (req, res) => {
  const payload = req.body

  if (
    !payload ||
    typeof payload.message !== 'string' ||
    payload.message.trim().length === 0
  ) {
    return res.status(400).json({ ok: false, error: 'Invalid log payload' })
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
    return res
      .status(500)
      .json({ ok: false, error: 'Failed to persist log entry' })
  }

  return res.json({ ok: true })
})

app.post('/api/convert', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ ok: false, error: '未提供有效的音频文件。' })
  }

  const bitrate = normalizeBitrate(req.body?.bitrate)
  const quality = normalizeQuality(req.body?.quality)

  const originalName = req.file.originalname || 'audio'
  const baseName = sanitizeFilename(
    originalName.replace(/\.[^/.]+$/, ''),
    'converted'
  )
  const outputFileName = `${baseName}-niu-ma.mp3`

  let tempFile

  try {
    tempFile = await createTempInputFile(req.file)
  } catch (error) {
    console.error('Failed to persist uploaded audio for conversion', error)
    return res
      .status(500)
      .json({ ok: false, error: '无法处理上传的音频文件，请稍后重试。' })
  }

  const cleanupTempFile = () => {
    if (!tempFile) {
      return
    }

    const { cleanup } = tempFile
    tempFile = null
    cleanup()
  }

  const ffmpegArgs = ['-y', '-i', tempFile.inputPath, '-vn']

  if (bitrate) {
    ffmpegArgs.push('-b:a', bitrate)
  } else if (quality) {
    ffmpegArgs.push('-qscale:a', quality)
  } else {
    ffmpegArgs.push('-b:a', '192k')
  }

  ffmpegArgs.push('-f', 'mp3', 'pipe:1')

  const executable = ffmpegPath || 'ffmpeg'
  const ffmpeg = spawn(executable, ffmpegArgs, {
    stdio: ['ignore', 'pipe', 'inherit']
  })

  let finished = false

  const handleError = (error) => {
    if (finished) {
      if (!res.writableEnded) {
        res.destroy(error)
      }
      return
    }

    finished = true
    console.error('Failed to convert audio file', error)

    cleanupTempFile()

    if (res.headersSent || res.writableEnded) {
      if (!res.writableEnded) {
        res.destroy(error)
      }
      return
    }

    res
      .status(500)
      .json({ ok: false, error: '音频转换失败，请稍后重试。', detail: error?.message })
  }

  ffmpeg.on('error', handleError)

  ffmpeg.stdout.on('error', (error) => {
    handleError(error)
  })

  ffmpeg.on('close', (code) => {
    cleanupTempFile()

    if (code !== 0) {
      handleError(new Error(`FFmpeg exited with code ${code}`))
    } else if (!finished) {
      finished = true
    }
  })

  res.setHeader('Content-Type', 'audio/mpeg')
  res.setHeader('Content-Disposition', encodeFilenameHeader(outputFileName))
  res.setHeader('X-Converted-Filename', encodeURIComponent(outputFileName))
  res.setHeader('X-Original-Filename', encodeURIComponent(originalName))
  res.setHeader('Cache-Control', 'no-store')

  res.on('close', () => {
    if (!ffmpeg.killed) {
      ffmpeg.kill('SIGKILL')
    }
    cleanupTempFile()
  })

  ffmpeg.stdout.pipe(res)
})

app.use(express.static(staticRoot))

app.use(async (_req, res) => {
  try {
    const html = await readFile(join(staticRoot, 'index.html'), 'utf8')
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.send(html)
  } catch (error) {
    console.error('Failed to load application UI', error)
    res
      .status(500)
      .send('Application UI is not built. Run "npm run build" first.')
  }
})

app.listen(port, () => {
  console.log(`Starting Niu Ma Tools server on port ${port}`)
})
