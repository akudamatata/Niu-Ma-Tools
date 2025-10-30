import { useRef, useState } from 'react'
import { useConvert } from './useConvert'

const ACCEPTED_TYPES = [
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  'audio/webm',
  'audio/mp4',
  'audio/aac',
  'audio/flac'
]

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const power = Math.floor(Math.log(bytes) / Math.log(1024))
  const value = bytes / Math.pow(1024, power)
  return `${value.toFixed(1)} ${units[power]}`
}

export function ConvertForm() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [bitrate, setBitrate] = useState('192k')
  const [isDragActive, setIsDragActive] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { convert, status } = useConvert()

  const acceptFile = (file: File | undefined) => {
    if (!file) return

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setFileError('暂不支持此类型的音频文件。')
      setSelectedFile(null)
      return
    }

    setFileError(null)
    setSelectedFile(file)
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    acceptFile(event.target.files?.[0])
    event.target.value = ''
  }

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragActive(false)
    const file = event.dataTransfer.files?.[0]
    acceptFile(file)
  }

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    if (!isDragActive) {
      setIsDragActive(true)
    }
  }

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    const nextTarget = event.relatedTarget as Node | null
    if (nextTarget && event.currentTarget.contains(nextTarget)) return
    setIsDragActive(false)
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedFile) return
    await convert(selectedFile, bitrate)
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-inner shadow-black/20"
    >
      <div className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-white/80" htmlFor="audio-file">
            选择音频文件
          </label>
          <input
            ref={fileInputRef}
            id="audio-file"
            type="file"
            accept={ACCEPTED_TYPES.join(',')}
            onChange={handleFileChange}
            className="sr-only"
          />
          <div
            role="button"
            tabIndex={0}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                fileInputRef.current?.click()
              }
            }}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`mt-3 flex flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-8 text-center transition ${
              isDragActive ? 'border-white/70 bg-white/10' : 'border-white/20 bg-white/5'
            } focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60`}
          >
            <span
              className={`flex h-12 w-12 items-center justify-center rounded-full transition ${
                isDragActive ? 'bg-white text-slate-900' : 'bg-white/10 text-white'
              }`}
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path d="M12 16V4m0 0 4 4m-4-4-4 4" strokeLinecap="round" strokeLinejoin="round" />
                <path
                  d="M6 12v6a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <p className="mt-4 text-sm text-white/80">
              将音频文件拖拽到此处，或
              <span className="ml-1 font-semibold text-white underline decoration-white/40 underline-offset-2">
                点击选择文件
              </span>
            </p>
            <p className="mt-2 text-xs text-white/60">支持 MP3、WAV、OGG、AAC 等常见格式</p>
          </div>
          {selectedFile && (
            <p className="mt-3 text-sm text-white/70">
              {selectedFile.name} · {formatBytes(selectedFile.size)}
            </p>
          )}
          {fileError && <p className="mt-3 text-sm text-red-300">{fileError}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-white/80" htmlFor="bitrate">
            输出比特率
          </label>
          <select
            id="bitrate"
            value={bitrate}
            onChange={(event) => setBitrate(event.target.value)}
            className="mt-2 w-full rounded-xl border border-white/20 bg-slate-900/60 px-4 py-3 text-sm text-white focus:border-white focus:outline-none focus:ring-2 focus:ring-white/40"
          >
            <option value="128k">128 kbps</option>
            <option value="192k">192 kbps</option>
            <option value="256k">256 kbps</option>
            <option value="320k">320 kbps</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={!selectedFile || status === 'converting'}
          className="w-full rounded-full bg-white px-6 py-3 text-base font-semibold text-slate-900 transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === 'converting' ? '转换中…' : '立即转换'}
        </button>
      </div>
    </form>
  )
}
