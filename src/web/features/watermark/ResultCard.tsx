import type {
  WatermarkError,
  WatermarkResult,
  WatermarkStatus
} from '../../store/useWatermarkStore'

interface Props {
  status: WatermarkStatus
  result: WatermarkResult | null
  error: WatermarkError | null
}

export function ResultCard({ status, result, error }: Props) {
  if (status === 'idle' && !result) {
    return (
      <div className="flex h-full min-h-[220px] items-center justify-center rounded-2xl border border-white/10 bg-slate-900/40 p-6 text-white/70">
        选择一张照片并填写地点信息，我们会自动生成今日水印。
      </div>
    )
  }

  if (status === 'processing') {
    return (
      <div className="flex h-full min-h-[220px] flex-col items-center justify-center gap-3 rounded-2xl border border-white/10 bg-slate-900/40 p-6 text-white/80">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-white/70" />
        <p>正在生成水印，请稍候...</p>
      </div>
    )
  }

  if (status === 'error' || error) {
    return (
      <div className="space-y-3 rounded-2xl border border-red-400/40 bg-red-500/10 p-6 text-red-100">
        <h3 className="text-lg font-semibold">生成失败</h3>
        <p>{error?.message ?? '抱歉，水印生成失败。'}</p>
        {error?.detail ? <p className="text-sm text-red-200">详情：{error.detail}</p> : null}
      </div>
    )
  }

  if (status === 'success' && result) {
    return (
      <div className="space-y-5 rounded-2xl border border-white/10 bg-slate-900/40 p-6 text-white/90">
        <div>
          <h3 className="text-lg font-semibold text-white">生成成功</h3>
          <p className="mt-1 text-sm text-white/70">以下预览即为生成结果，点击下方按钮可下载原图尺寸。</p>
        </div>
        <figure className="overflow-hidden rounded-xl border border-white/10 bg-black/30">
          <img
            src={result.url}
            alt="生成的水印图片预览"
            className="h-auto w-full object-contain"
            loading="lazy"
          />
        </figure>
        <div className="rounded-xl bg-black/40 p-4">
          <p className="text-sm text-white/60">文件名：{result.filename}</p>
          <p className="text-sm text-white/60">大小：{result.size}</p>
        </div>
        <a
          href={result.url}
          download={result.filename}
          className="inline-flex items-center justify-center rounded-full bg-emerald-400 px-6 py-3 text-sm font-semibold text-slate-900 shadow-lg transition hover:bg-emerald-300"
        >
          下载水印图片
        </a>
      </div>
    )
  }

  return null
}
