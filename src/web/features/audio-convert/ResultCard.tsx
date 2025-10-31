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
      return (
        <div className="text-center text-sm leading-relaxed text-white/70">
          选择音频文件并点击
          <span className="mx-1 rounded-full bg-white/10 px-2 py-1 text-xs font-semibold text-white">立即转换</span>
          开始处理，我们会在服务器上自动完成转码。
        </div>
      )
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
        <div className="rounded-2xl border border-rose-400/40 bg-rose-500/10 p-6 text-left text-rose-100">
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
    <div className="flex h-full min-h-[320px] flex-col justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-white/10 via-white/5 to-transparent p-6 shadow-inner shadow-black/30">
      {renderContent()}
    </div>
  )
}
