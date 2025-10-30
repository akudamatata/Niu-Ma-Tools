import express from 'express'
import cors from 'cors'
import multer from 'multer'
import ffmpegPath from 'ffmpeg-static'
import ExcelJS from 'exceljs'
import { read as readSpreadsheet, utils as xlsxUtils } from 'xlsx'
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

const imageMimeToExtension = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/heic': '.heic',
  'image/heif': '.heif',
  'image/webp': '.webp'
}

const ledgerValidDepartments = [
  '市政中心',
  '环卫中心',
  '园林中心',
  '直属二大队',
  '直属三大队',
  '智慧停车管理中心',
  '向阳大队',
  '铁东大队',
  '全宁大队',
  '振兴大队',
  '松州大队',
  '玉龙大队',
  '兴安大队',
  '松城大队',
  '人事财务股'
]

const ledgerKeywordMap = new Map([
  ['向阳城管大队', '向阳大队'],
  ['向阳大队', '向阳大队'],
  ['铁东城管大队', '铁东大队'],
  ['铁东大队', '铁东大队'],
  ['全宁城管大队', '全宁大队'],
  ['全宁大队', '全宁大队'],
  ['振兴城管大队', '振兴大队'],
  ['振兴大队', '振兴大队'],
  ['松州城管大队', '松州大队'],
  ['松州大队', '松州大队'],
  ['玉龙城管大队', '玉龙大队'],
  ['玉龙大队', '玉龙大队'],
  ['兴安城管大队', '兴安大队'],
  ['兴安大队', '兴安大队'],
  ['松城城管大队', '松城大队'],
  ['松城大队', '松城大队'],
  ['三大队', '直属三大队'],
  ['二大队', '直属二大队'],
  ['北京养护集团', '市政中心'],
  ['市政', '市政中心'],
  ['市政部', '市政中心'],
  ['环境卫生服务中心', '环卫中心'],
  ['京环公司', '环卫中心'],
  ['环卫', '环卫中心'],
  ['园林', '园林中心'],
  ['亿城', '园林中心'],
  ['停车管理', '智慧停车管理中心'],
  ['停车服务管理', '智慧停车管理中心'],
  ['人事财务', '人事财务股']
])

const ledgerPatterns = [
  /责成(.*?)进行/, 
  /立即转(.*?)进行/,
  /责成(.*?)处办/,
  /立即责成(.*?)进行/,
  /立即责成(.*?)处办/
]

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

async function createTempImageFile(file) {
  const workingDir = await mkdtemp(join(tmpdir(), 'niu-ma-watermark-'))

  const originalExt = extname(file.originalname || '').toLowerCase()
  const fallbackExt = imageMimeToExtension[file.mimetype] ?? ''
  const ext = originalExt || fallbackExt || '.img'
  const inputPath = join(workingDir, `input${ext}`)

  await writeFile(inputPath, file.buffer)

  const cleanup = async () => {
    try {
      await rm(workingDir, { recursive: true, force: true })
    } catch (error) {
      console.error('Failed to clean temporary working directory', error)
    }
  }

  return { inputPath, cleanup, workingDir }
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

function encodeFilenameHeader(name, fallback = 'download') {
  const sanitized = sanitizeFilename(name, fallback)
  const asciiFallback = sanitized.replace(/[^ -~]+/g, '_')
  const safeAscii = asciiFallback.length > 0 ? asciiFallback : fallback
  const encoded = encodeURIComponent(sanitized)
  return `attachment; filename="${safeAscii}"; filename*=UTF-8''${encoded}`
}

function assignLedgerDepartment(content) {
  if (typeof content !== 'string' || content.trim().length === 0) {
    return '未匹配'
  }

  const normalized = content.trim()

  for (const [keyword, department] of ledgerKeywordMap.entries()) {
    if (normalized.includes(keyword)) {
      return department
    }
  }

  for (const pattern of ledgerPatterns) {
    const match = normalized.match(pattern)

    if (match && match[1]) {
      let department = match[1].trim()
      department = department.replace(/[()（）\s]/g, '')
      department = department.replace(/科室/g, '').trim()

      if (ledgerValidDepartments.includes(department)) {
        return department
      }

      const fuzzyMatch = ledgerValidDepartments.find((valid) =>
        valid.includes(department)
      )

      if (fuzzyMatch) {
        return fuzzyMatch
      }
    }
  }

  return '未匹配'
}

const app = express()

app.use(cors())
app.use(express.json())
app.use('/assets', express.static(join(staticRoot, 'assets')))

const projectAssetsDir = resolve('assets')
if (existsSync(projectAssetsDir)) {
  app.use('/assets', express.static(projectAssetsDir))
}
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

app.post('/api/ledger-analysis', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ ok: false, error: '请上传一个 Excel 或 CSV 文件。' })
  }

  const originalName = req.file.originalname || 'ledger.xlsx'
  const ext = extname(originalName).toLowerCase()

  if (!['.xlsx', '.xls', '.csv'].includes(ext)) {
    return res.status(400).json({ ok: false, error: '暂不支持的文件格式，请上传 Excel 或 CSV 文件。' })
  }

  let sheet

  try {
    const workbook = readSpreadsheet(req.file.buffer, {
      type: 'buffer',
      raw: false,
      cellDates: false,
      cellNF: false,
      cellText: false
    })

    const sheetName = workbook.SheetNames?.[0]
    if (!sheetName) {
      return res.status(400).json({ ok: false, error: '文件内容为空或无法读取。' })
    }

    sheet = workbook.Sheets[sheetName]
  } catch (error) {
    console.error('Failed to parse ledger file', error)
    return res.status(400).json({ ok: false, error: '无法读取上传的文件，请确认文件格式正确。' })
  }

  const headerRows = xlsxUtils.sheet_to_json(sheet, { header: 1, defval: '' })
  const headerOrder = Array.isArray(headerRows?.[0])
    ? headerRows[0].map((value) => String(value ?? '').trim()).filter((value) => value.length > 0)
    : []

  const rawRows = xlsxUtils.sheet_to_json(sheet, { defval: '' })

  if (!Array.isArray(rawRows) || rawRows.length === 0) {
    return res.status(400).json({ ok: false, error: '所选文件是空的。' })
  }

  if (!headerOrder.includes('答复内容')) {
    const hasColumn = rawRows.some((row) => Object.prototype.hasOwnProperty.call(row, '答复内容'))
    if (!hasColumn) {
      return res.status(400).json({ ok: false, error: "所选文件没有'答复内容'列。" })
    }
  }

  const processedRows = rawRows.map((row) => {
    const content = Object.prototype.hasOwnProperty.call(row, '答复内容') ? row['答复内容'] : ''
    const department = assignLedgerDepartment(content)
    return { ...row, 权属部门: department }
  })

  const matchedRows = processedRows.filter((row) => ledgerValidDepartments.includes(row.权属部门))
  const unmatchedRows = processedRows.filter((row) => !ledgerValidDepartments.includes(row.权属部门))

  if (matchedRows.length === 0) {
    return res.status(400).json({ ok: false, error: '没有成功匹配任何条目。' })
  }

  const columnOrderBase = headerOrder.filter((header) => header !== '权属部门')

  const extraColumns = []
  for (const row of processedRows) {
    for (const key of Object.keys(row)) {
      if (key && key !== '权属部门' && !columnOrderBase.includes(key) && !extraColumns.includes(key)) {
        extraColumns.push(key)
      }
    }
  }

  const columnOrder = [...columnOrderBase, ...extraColumns, '权属部门']

  const counts = new Map()
  for (const row of matchedRows) {
    const dept = row.权属部门
    counts.set(dept, (counts.get(dept) ?? 0) + 1)
  }

  const totalProcessed = matchedRows.length
  const totalUnmatched = unmatchedRows.length
  const grandTotal = totalProcessed + totalUnmatched

  const analysisEntries = Array.from(counts.entries()).sort((a, b) => {
    if (b[1] !== a[1]) {
      return b[1] - a[1]
    }
    return a[0].localeCompare(b[0], 'zh-Hans-CN')
  })

  const analysisRows = analysisEntries.map(([dept, count]) => ({
    权属部门: dept,
    数量: count,
    占比: totalProcessed > 0 ? `${((count / totalProcessed) * 100).toFixed(2)}%` : '0.00%'
  }))

  analysisRows.push(
    { 权属部门: '已办结', 数量: totalProcessed, 占比: '' },
    { 权属部门: '核实退回', 数量: totalUnmatched, 占比: '' },
    { 权属部门: '总计', 数量: grandTotal, 占比: '' }
  )

  const workbook = new ExcelJS.Workbook()

  const resultsSheet = workbook.addWorksheet('分析结果')
  resultsSheet.columns = columnOrder.map((column) => ({ header: column, key: column, width: 30 }))
  resultsSheet.addRows(matchedRows)

  const analysisSheet = workbook.addWorksheet('部门分析')
  analysisSheet.columns = [
    { header: '权属部门', key: '权属部门', width: 25 },
    { header: '数量', key: '数量', width: 15 },
    { header: '占比', key: '占比', width: 15 }
  ]
  analysisSheet.addRows(analysisRows)

  const unmatchedSheet = workbook.addWorksheet('未匹配')
  unmatchedSheet.columns = columnOrder.map((column) => ({ header: column, key: column, width: 30 }))
  unmatchedSheet.addRows(unmatchedRows)

  const headerFontLarge = { name: '黑体', size: 20, bold: true }
  const headerFontMedium = { name: '黑体', size: 16, bold: true }
  const dataFontLarge = { name: '黑体', size: 16 }
  const dataFontMedium = { name: '黑体', size: 14 }
  const summaryFont = { name: '黑体', size: 14, bold: true }

  const centerAlign = { vertical: 'middle', horizontal: 'center', wrapText: true }
  const leftAlign = { vertical: 'middle', horizontal: 'left', wrapText: true }

  resultsSheet.getRow(1).eachCell((cell) => {
    cell.font = headerFontLarge
    cell.alignment = centerAlign
  })

  resultsSheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) {
      return
    }

    row.eachCell((cell, colNumber) => {
      cell.font = dataFontLarge
      const columnKey = resultsSheet.getColumn(colNumber).key
      cell.alignment = columnKey === '权属部门' ? centerAlign : leftAlign
    })
  })

  analysisSheet.getRow(1).eachCell((cell) => {
    cell.font = headerFontMedium
    cell.alignment = centerAlign
  })

  analysisSheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) {
      return
    }

    const isSummaryRow = ['已办结', '核实退回', '总计'].includes(row.getCell(1).value)

    row.eachCell((cell) => {
      cell.font = isSummaryRow ? summaryFont : dataFontMedium
      cell.alignment = centerAlign
    })
  })

  unmatchedSheet.getRow(1).eachCell((cell) => {
    cell.font = headerFontLarge
    cell.alignment = centerAlign
  })

  unmatchedSheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) {
      return
    }

    row.eachCell((cell, colNumber) => {
      cell.font = dataFontLarge
      const columnKey = unmatchedSheet.getColumn(colNumber).key
      cell.alignment = columnKey === '权属部门' ? centerAlign : leftAlign
    })
  })

  try {
    const buffer = await workbook.xlsx.writeBuffer()
    const baseName = sanitizeFilename(originalName.replace(/\.[^/.]+$/, '') || 'ledger')
    const outputName = `${baseName}-分析结果.xlsx`

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    res.setHeader('Content-Disposition', encodeFilenameHeader(outputName))
    res.setHeader('X-Analysis-Processed', String(totalProcessed))
    res.setHeader('X-Analysis-Unmatched', String(totalUnmatched))
    res.setHeader('X-Analysis-Total', String(grandTotal))

    return res.send(Buffer.from(buffer))
  } catch (error) {
    console.error('Failed to generate ledger workbook', error)
    return res.status(500).json({ ok: false, error: '生成分析文件失败，请稍后重试。' })
  }
})

app.post('/api/watermark', upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ ok: false, error: '未提供有效的图片文件。' })
  }

  let tempFile

  try {
    tempFile = await createTempImageFile(req.file)
  } catch (error) {
    console.error('Failed to persist uploaded image for watermarking', error)
    return res
      .status(500)
      .json({ ok: false, error: '无法处理上传的图片文件，请稍后重试。' })
  }

  const cleanup = async () => {
    if (!tempFile) {
      return
    }

    const { cleanup: dispose } = tempFile
    tempFile = null
    await dispose()
  }

  const location = String(req.body?.location ?? '').trim()
  const temperature = String(req.body?.temperature ?? '').trim()

  const outputPath = join(tempFile.workingDir, 'output.png')
  const pythonExecutable = process.env.PYTHON_EXECUTABLE || 'python3'
  const scriptPath = resolve('watermark.py')

  const args = [
    scriptPath,
    '--input',
    tempFile.inputPath,
    '--output',
    outputPath,
    '--location',
    location,
    '--temperature',
    temperature
  ]

  try {
    await new Promise((resolvePromise, rejectPromise) => {
      const python = spawn(pythonExecutable, args, {
        stdio: ['ignore', 'pipe', 'pipe']
      })

      let stderr = ''

      python.stderr.on('data', (chunk) => {
        stderr += chunk.toString()
      })

      python.on('error', (error) => {
        rejectPromise(Object.assign(new Error('水印脚本执行失败'), { detail: error.message }))
      })

      python.on('close', (code) => {
        if (code === 0) {
          resolvePromise()
        } else {
          rejectPromise(
            Object.assign(new Error(`Watermark script exited with code ${code}`), {
              detail: stderr.trim() || undefined
            })
          )
        }
      })
    })
  } catch (error) {
    console.error('Failed to generate watermark', error)
    await cleanup()
    return res.status(500).json({
      ok: false,
      error: '水印生成失败，请稍后重试。',
      detail: error?.detail ?? error?.message
    })
  }

  let outputBuffer

  try {
    outputBuffer = await readFile(outputPath)
  } catch (error) {
    console.error('Failed to read watermark output file', error)
    await cleanup()
    return res
      .status(500)
      .json({ ok: false, error: '生成的水印图片暂不可用，请稍后重试。' })
  }

  await cleanup()

  const originalName = req.file.originalname || 'photo'
  const baseName = sanitizeFilename(originalName.replace(/\.[^/.]+$/, '') || 'photo', 'photo')
  const outputFileName = `${baseName}-watermark.png`

  res.setHeader('Content-Type', 'image/png')
  res.setHeader('Content-Disposition', encodeFilenameHeader(outputFileName))
  res.setHeader('X-Watermark-Filename', encodeURIComponent(outputFileName))
  res.setHeader('X-Watermark-Location', encodeURIComponent(location || ''))
  if (temperature) {
    res.setHeader('X-Watermark-Temperature', encodeURIComponent(temperature))
  }
  res.setHeader('Cache-Control', 'no-store')

  return res.send(outputBuffer)
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
  const uniqueSuffix = randomUUID().replace(/-/g, '').slice(0, 8)
  const outputFileName = `${baseName}-${uniqueSuffix}-covered.mp3`

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
