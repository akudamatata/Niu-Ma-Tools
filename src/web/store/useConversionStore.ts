import { create } from 'zustand'
import { createFFmpeg, type FFmpeg } from '@ffmpeg/ffmpeg'

export type ConversionStatus = 'idle' | 'converting' | 'success' | 'error'

export interface ConversionResult {
  url: string
  filename: string
  size: string
}

export interface ConversionError {
  message: string
  detail?: string
}

interface ConversionState {
  status: ConversionStatus
  result: ConversionResult | null
  error: ConversionError | null
  convert: (file: File, bitrate: string) => Promise<void>
  reset: () => void
}

function formatFileSize(bytes: number) {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const power = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  const value = bytes / Math.pow(1024, power)
  return `${value.toFixed(2)} ${units[power]}`
}

let ffmpegInstance: FFmpeg | null = null
let loadPromise: Promise<void> | null = null
let commandQueue: Promise<void> = Promise.resolve()

const CORE_VERSION = '0.12.6'
const FFMPEG_BASE_URL = `https://unpkg.com/@ffmpeg/core-st@${CORE_VERSION}/dist/`

async function ensureFFmpeg() {
  if (typeof window === 'undefined') {
    throw new Error('当前环境不支持 Web 转码。')
  }

  if (!ffmpegInstance) {
    ffmpegInstance = createFFmpeg({
      log: true,
      mainName: 'main',
      corePath: `${FFMPEG_BASE_URL}ffmpeg-core.js`,
      wasmPath: `${FFMPEG_BASE_URL}ffmpeg-core.wasm`,
      workerPath: `${FFMPEG_BASE_URL}ffmpeg-core.worker.js`
    })
  }

  if (!loadPromise) {
    loadPromise = ffmpegInstance
      .load()
      .catch((error) => {
        ffmpegInstance = null
        loadPromise = null
        throw error
      })
  }

  await loadPromise
  return ffmpegInstance
}

export const useConversionStore = create<ConversionState>((set) => ({
  status: 'idle',
  result: null,
  error: null,
  reset: () => set({ status: 'idle', result: null, error: null }),
  convert: async (file: File, bitrate: string) => {
    set({ status: 'converting', error: null, result: null })

    const task = async () => {
      const ffmpeg = await ensureFFmpeg()

      const id = crypto.randomUUID()
      const inputFile = `${id}-input`
      const outputFile = `${id}-output.mp3`

      try {
        const fileBuffer = await file.arrayBuffer()

        ffmpeg.FS('writeFile', inputFile, new Uint8Array(fileBuffer))
        await ffmpeg.run('-i', inputFile, '-b:a', bitrate, outputFile)
        const data = ffmpeg.FS('readFile', outputFile)
        const arrayBuffer = data.buffer.slice(
          data.byteOffset,
          data.byteOffset + data.byteLength
        ) as ArrayBuffer

        const blob = new Blob([arrayBuffer], { type: 'audio/mpeg' })
        const url = URL.createObjectURL(blob)
        const filename = `${file.name.replace(/\.[^/.]+$/, '') || 'converted'}-niu-ma.mp3`

        set({
          status: 'success',
          result: {
            url,
            filename,
            size: formatFileSize(blob.size)
          }
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : '未知错误'
        set({
          status: 'error',
          error: {
            message: '转换失败，请重试。',
            detail: message
          }
        })
      } finally {
        try {
          ffmpeg.FS('unlink', inputFile)
        } catch {
          // ignore cleanup errors
        }

        try {
          ffmpeg.FS('unlink', outputFile)
        } catch {
          // ignore cleanup errors
        }
      }
    }
    commandQueue = commandQueue.then(task, task)
    await commandQueue
  }
}))
