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

export const useConversionStore = create<ConversionState>((set) => ({
  status: 'idle',
  result: null,
  error: null,
  reset: () => set({ status: 'idle', result: null, error: null }),
  convert: async (file: File, bitrate: string) => {
    set({ status: 'converting', error: null, result: null })

    const formData = new FormData()
    formData.append('file', file)
    formData.append('bitrate', bitrate)

    let response: Response

    try {
      response = await fetch('/api/convert', {
        method: 'POST',
        body: formData
      })
    } catch (error) {
      set({
        status: 'error',
        result: null,
        error: {
          message: '无法连接到转换服务，请检查网络后重试。',
          detail: error instanceof Error ? error.message : undefined
        }
      })
      return
    }

    if (!response.ok) {
      let detail: string | undefined

      const contentType = response.headers.get('content-type') ?? ''

      try {
        if (contentType.includes('application/json')) {
          const data = (await response.json()) as { error?: string; message?: string }
          detail = data.error ?? data.message
        } else {
          detail = await response.text()
        }
      } catch (parseError) {
        detail = parseError instanceof Error ? parseError.message : undefined
      }

      set({
        status: 'error',
        result: null,
        error: {
          message: '转换失败，请重试。',
          detail
        }
      })
      return
    }

    const blob = await response.blob()
    const encodedName = response.headers.get('x-converted-filename')
    const contentDisposition = response.headers.get('content-disposition')

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
      (encodedName && (() => {
        try {
          return decodeURIComponent(encodedName)
        } catch {
          return encodedName
        }
      })()) ||
      filenameFromContentDisposition ||
      `${file.name.replace(/\.[^/.]+$/, '') || 'converted'}-niu-ma.mp3`

    const url = URL.createObjectURL(blob)

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
