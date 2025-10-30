import { motion } from 'framer-motion'
import type { ConversionError, ConversionResult, ConversionStatus } from '../../store/useConversionStore'

interface ResultCardProps {
  status: ConversionStatus
  result: ConversionResult | null
  error: ConversionError | null
}

export function ResultCard({ status, result, error }: ResultCardProps) {
  const renderContent = () => {
    if (status === 'idle') {
      return <p className="text-white/60">选择音频文件并点击「立即转换」开始处理。</p>
    }

    if (status === 'converting') {
      return (
        <div className="flex flex-col items-center gap-4 text-white/80">
          <div className="h-16 w-16 animate-spin rounded-full border-4 border-white/20 border-t-white"></div>
          <p>FFmpeg 正在努力工作中，请稍候...</p>
        </div>
      )
    }

    if (status === 'error' && error) {
      return (
        <div className="rounded-2xl border border-rose-400/40 bg-rose-500/10 p-6 text-rose-100">
          <h3 className="text-lg font-semibold">转换失败</h3>
          <p className="mt-2 text-sm opacity-80">{error.message}</p>
          {error.detail && <pre className="mt-4 whitespace-pre-wrap text-xs opacity-70">{error.detail}</pre>}
        </div>
      )
    }

    if (status === 'success' && result) {
      return (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-2xl border border-emerald-400/40 bg-emerald-500/10 p-6 text-emerald-100"
        >
          <h3 className="text-lg font-semibold">转换完成 🎉</h3>
          <p className="mt-2 text-sm opacity-80">
            输出文件：<strong>{result.filename}</strong> · {result.size}
          </p>
          <a
            href={result.url}
            download={result.filename}
            className="mt-4 inline-flex items-center justify-center rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:scale-[1.02]"
          >
            下载 MP3
          </a>
        </motion.div>
      )
    }

    return null
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-inner shadow-black/20">
      {renderContent()}
    </div>
  )
}
