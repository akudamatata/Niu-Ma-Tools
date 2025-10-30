import { useState } from 'react'
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
  const { convert, status } = useConvert()

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setSelectedFile(file)
    }
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
          <label
            htmlFor="audio-file"
            className="block text-sm font-medium text-white/80"
          >
            选择音频文件
          </label>
          <input
            id="audio-file"
            type="file"
            accept={ACCEPTED_TYPES.join(',')}
            onChange={handleFileChange}
            className="mt-2 w-full cursor-pointer rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white placeholder-white/50 focus:border-white focus:outline-none focus:ring-2 focus:ring-white/40"
            required
          />
          {selectedFile && (
            <p className="mt-2 text-sm text-white/60">
              {selectedFile.name} · {formatBytes(selectedFile.size)}
            </p>
          )}
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
