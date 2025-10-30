import { create } from 'zustand'

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

let worker: Worker | null = null

function ensureWorker() {
  if (typeof window === 'undefined') {
    return null
  }

  if (!worker) {
    worker = new Worker(new URL('../features/audio-convert/ffmpeg.worker.ts', import.meta.url), {
      type: 'module'
    })
  }

  return worker
}

export const useConversionStore = create<ConversionState>((set) => ({
  status: 'idle',
  result: null,
  error: null,
  reset: () => set({ status: 'idle', result: null, error: null }),
  convert: async (file: File, bitrate: string) => {
    const ffmpegWorker = ensureWorker()

    if (!ffmpegWorker) {
      set({
        status: 'error',
        error: { message: '当前环境不支持 Web Worker 转码。' },
        result: null
      })
      return
    }

    const id = crypto.randomUUID()

    set({ status: 'converting', error: null, result: null })

    const fileBuffer = await file.arrayBuffer()

    const response = await new Promise<{ status: string; payload: any }>((resolve) => {
      const handleMessage = (event: MessageEvent) => {
        if (event.data?.id !== id) return
        ffmpegWorker.removeEventListener('message', handleMessage)
        resolve(event.data)
      }

      ffmpegWorker.addEventListener('message', handleMessage)

      ffmpegWorker.postMessage({
        id,
        fileData: fileBuffer,
        inputName: file.name,
        bitrate
      }, [fileBuffer])
    })

    if (response.status === 'error') {
      set({
        status: 'error',
        error: {
          message: '转换失败，请重试。',
          detail: response.payload?.message
        }
      })
      return
    }

    const payload = response.payload as { buffer: ArrayBuffer; inputName: string }
    const blob = new Blob([payload.buffer], { type: 'audio/mpeg' })
    const url = URL.createObjectURL(blob)
    const filename = `${payload.inputName.replace(/\.[^/.]+$/, '') || 'converted'}-niu-ma.mp3`

    set({
      status: 'success',
      result: {
        url,
        filename,
        size: formatFileSize(blob.size)
      }
    })
  }
}))
