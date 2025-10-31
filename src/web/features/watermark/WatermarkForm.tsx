import { useRef, useState } from 'react'
import { useWatermarkStore } from '../../store/useWatermarkStore'

export function WatermarkForm() {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [location, setLocation] = useState('')
  const [temperature, setTemperature] = useState('26℃')
  const [weather, setWeather] = useState('多云')
  const status = useWatermarkStore((state) => state.status)
  const error = useWatermarkStore((state) => state.error)
  const generate = useWatermarkStore((state) => state.generate)
  const reset = useWatermarkStore((state) => state.reset)

  const isProcessing = status === 'processing'

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const [file] = event.target.files ?? []

    if (!file) {
      setSelectedFile(null)
      return
    }

    setSelectedFile(file)
    reset()
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!selectedFile) {
      return
    }

    await generate(selectedFile, {
      location: location.trim(),
      temperature: temperature.trim(),
      weather: weather.trim()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-3">
        <label className="block text-sm font-medium text-white/80">选择照片</label>
        <div
          className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/40 bg-white/5 px-6 py-10 text-center transition hover:border-white/70 hover:bg-white/10"
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/heic,image/heif"
            className="hidden"
            onChange={handleFileChange}
          />
          <div className="rounded-full bg-white/10 px-4 py-1 text-xs tracking-widest text-white/70">点击上传或拖拽</div>
          <p className="text-sm text-white/70">
            支持常见的 JPG / PNG / HEIC 图片格式。我们不会保存你的原图，生成结果会在浏览器中直接返回。
          </p>
          {selectedFile ? (
            <p className="text-sm text-sky-200">当前选择：{selectedFile.name}</p>
          ) : (
            <p className="text-sm text-white/50">尚未选择图片文件</p>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <label className="space-y-2 text-sm text-white/80">
          <span>拍摄地点</span>
          <input
            type="text"
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            placeholder="如：沃尔玛超市"
            className="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white placeholder:text-white/40 focus:border-sky-300 focus:outline-none"
          />
        </label>
        <label className="space-y-2 text-sm text-white/80">
          <span>天气状况</span>
          <input
            type="text"
            value={weather}
            onChange={(event) => setWeather(event.target.value)}
            placeholder="如：多云"
            className="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white placeholder:text-white/40 focus:border-sky-300 focus:outline-none"
          />
        </label>
        <label className="space-y-2 text-sm text-white/80">
          <span>实时温度</span>
          <input
            type="text"
            value={temperature}
            onChange={(event) => setTemperature(event.target.value)}
            placeholder="如：26℃"
            className="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white placeholder:text-white/40 focus:border-sky-300 focus:outline-none"
          />
        </label>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          <p className="font-semibold">{error.message}</p>
          {error.detail ? <p className="mt-1 text-xs text-red-200">详情：{error.detail}</p> : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={!selectedFile || isProcessing}
          className="rounded-full bg-sky-400 px-6 py-3 text-sm font-semibold text-slate-900 shadow-lg transition hover:bg-sky-300 disabled:cursor-not-allowed disabled:bg-slate-500/60 disabled:text-white/70"
        >
          {isProcessing ? '正在生成...' : '生成水印照片'}
        </button>
        <button
          type="button"
          onClick={() => {
            setSelectedFile(null)
            reset()
            if (fileInputRef.current) {
              fileInputRef.current.value = ''
            }
          }}
          className="rounded-full border border-white/30 px-6 py-3 text-sm font-semibold text-white/70 transition hover:bg-white/10"
        >
          重置
        </button>
      </div>
    </form>
  )
}
