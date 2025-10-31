import { useMemo, useRef, useState } from 'react'
import { useWatermarkStore } from '../../store/useWatermarkStore'

export function WatermarkForm() {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [location, setLocation] = useState('')
  const [temperature, setTemperature] = useState('26℃')
  const [weather, setWeather] = useState('多云')
  const datetimeDefaults = useMemo(() => {
    const now = new Date()
    const pad = (value: number) => value.toString().padStart(2, '0')
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'] as const
    return {
      date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
      time: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
      weekday: `星期${weekdays[now.getDay()]}`
    }
  }, [])
  const [dateText, setDateText] = useState(datetimeDefaults.date)
  const [timeText, setTimeText] = useState(datetimeDefaults.time)
  const [weekdayText, setWeekdayText] = useState(datetimeDefaults.weekday)
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
      weather: weather.trim(),
      date: dateText.trim(),
      time: timeText.trim(),
      weekday: weekdayText.trim()
    })
  }

  function restoreDatetimeDefaults() {
    const now = new Date()
    const pad = (value: number) => value.toString().padStart(2, '0')
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'] as const
    setDateText(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`)
    setTimeText(`${pad(now.getHours())}:${pad(now.getMinutes())}`)
    setWeekdayText(`星期${weekdays[now.getDay()]}`)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-3">
        <label className="block text-sm font-medium text-white/80">选择照片</label>
        <div
          className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/40 bg-white/5 px-6 py-8 text-center transition hover:border-white/70 hover:bg-white/10"
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
            <div className="w-full text-center">
              <p
                className="mx-auto max-w-full truncate text-sm text-sky-200"
                title={selectedFile.name}
              >
                当前选择：{selectedFile.name}
              </p>
            </div>
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

      <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div>
          <h3 className="text-sm font-semibold text-white/80">时间信息</h3>
          <p className="mt-1 text-xs text-white/60">可自定义日期、时间与星期显示内容，留空则使用当前时间。</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="space-y-2 text-sm text-white/80">
            <span>日期</span>
            <input
              type="date"
              value={dateText}
              onChange={(event) => setDateText(event.target.value)}
              className="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white placeholder:text-white/40 focus:border-sky-300 focus:outline-none"
            />
          </label>
          <label className="space-y-2 text-sm text-white/80">
            <span>时间</span>
            <input
              type="time"
              value={timeText}
              onChange={(event) => setTimeText(event.target.value)}
              className="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white placeholder:text-white/40 focus:border-sky-300 focus:outline-none"
            />
          </label>
          <label className="space-y-2 text-sm text-white/80">
            <span>星期</span>
            <input
              type="text"
              value={weekdayText}
              onChange={(event) => setWeekdayText(event.target.value)}
              placeholder="如：星期四"
              className="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white placeholder:text-white/40 focus:border-sky-300 focus:outline-none"
            />
          </label>
        </div>
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
            restoreDatetimeDefaults()
          }}
          className="rounded-full border border-white/30 px-6 py-3 text-sm font-semibold text-white/70 transition hover:bg-white/10"
        >
          重置
        </button>
      </div>
    </form>
  )
}
