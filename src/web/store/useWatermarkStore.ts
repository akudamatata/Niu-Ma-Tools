import { create } from 'zustand'

export type WatermarkStatus = 'idle' | 'processing' | 'success' | 'error'

export interface WatermarkResult {
  url: string
  filename: string
  size: string
}

export interface WatermarkError {
  message: string
  detail?: string
}

interface WatermarkState {
  status: WatermarkStatus
  result: WatermarkResult | null
  error: WatermarkError | null
  generate: (
    file: File,
    payload: {
      location: string
      temperature: string
      weather: string
      date: string
      time: string
      weekday: string
    }
  ) => Promise<void>
  reset: () => void
}

function formatFileSize(bytes: number) {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const power = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  const value = bytes / Math.pow(1024, power)
  return `${value.toFixed(2)} ${units[power]}`
}

export const useWatermarkStore = create<WatermarkState>((set) => ({
  status: 'idle',
  result: null,
  error: null,
  reset: () =>
    set((state) => {
      if (state.result?.url) {
        URL.revokeObjectURL(state.result.url)
      }

      return { status: 'idle', result: null, error: null }
    }),
  generate: async (file, payload) => {
    set((state) => {
      if (state.result?.url) {
        URL.revokeObjectURL(state.result.url)
      }

      return { status: 'processing', error: null, result: null }
    })

    const formData = new FormData()
    formData.append('image', file)
    formData.append('location', payload.location)
    formData.append('temperature', payload.temperature)
    formData.append('weather', payload.weather)
    formData.append('date', payload.date)
    formData.append('time', payload.time)
    formData.append('weekday', payload.weekday)

    let response: Response

    try {
      response = await fetch('/api/watermark', {
        method: 'POST',
        body: formData
      })
    } catch (error) {
      set({
        status: 'error',
        result: null,
        error: {
          message: '无法连接到水印服务，请稍后再试。',
          detail: error instanceof Error ? error.message : undefined
        }
      })
      return
    }

    if (!response.ok) {
      let detail: string | undefined

      try {
        const contentType = response.headers.get('content-type') ?? ''
        if (contentType.includes('application/json')) {
          const data = (await response.json()) as { error?: string; detail?: string }
          detail = data.detail ?? data.error
        } else {
          detail = await response.text()
        }
      } catch (error) {
        detail = error instanceof Error ? error.message : undefined
      }

      set({
        status: 'error',
        result: null,
        error: {
          message: '水印生成失败，请稍后再试。',
          detail
        }
      })
      return
    }

    const blob = await response.blob()
    const url = URL.createObjectURL(blob)

    const filenameHeader = response.headers.get('x-watermark-filename')
    const contentDisposition = response.headers.get('content-disposition')

    const filenameFromHeader = (() => {
      if (!filenameHeader) return null
      try {
        return decodeURIComponent(filenameHeader)
      } catch {
        return filenameHeader
      }
    })()

    const filenameFromContentDisposition = (() => {
      if (!contentDisposition) return null
      const match = contentDisposition.match(/filename\*?=(?:UTF-8''|\")?([^;"']+)/i)
      if (!match) return null
      try {
        return decodeURIComponent(match[1].replace(/\"/g, ''))
      } catch {
        return match[1].replace(/\"/g, '')
      }
    })()

    const filename =
      filenameFromHeader ||
      filenameFromContentDisposition ||
      `${file.name.replace(/\.[^/.]+$/, '') || 'watermark'}-${Date.now()}-marked.png`

    set((state) => {
      if (state.result?.url) {
        URL.revokeObjectURL(state.result.url)
      }

      return {
        status: 'success',
        result: {
          url,
          filename,
          size: formatFileSize(blob.size)
        },
        error: null
      }
    })
  }
}))
