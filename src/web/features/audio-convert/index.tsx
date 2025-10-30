import { motion } from 'framer-motion'
import { ConvertForm } from './ConvertForm'
import { ResultCard } from './ResultCard'
import { useConversionStore } from '../../store/useConversionStore'

export default function AudioConvertFeature() {
  const { status, result, error } = useConversionStore((state) => ({
    status: state.status,
    result: state.result,
    error: state.error
  }))

  return (
    <motion.div
      className="rounded-3xl bg-slate-950/70 p-8 shadow-2xl backdrop-blur"
      initial={{ opacity: 0, y: 60 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      viewport={{ once: true }}
    >
      <div className="flex flex-col gap-8 lg:flex-row">
        <div className="flex-1 space-y-6">
          <h2 className="text-3xl font-semibold text-white">音频转 MP3</h2>
          <p className="text-white/70">
            上传你的音频文件（WAV、AAC、OGG 等），我们会在浏览器内使用 WebAssembly 版 FFmpeg
            将其转为高质量 MP3。整个过程不会上传到服务器，数据安全无忧。
          </p>
          <ConvertForm />
        </div>
        <div className="flex-1">
          <ResultCard status={status} result={result} error={error} />
        </div>
      </div>
    </motion.div>
  )
}
