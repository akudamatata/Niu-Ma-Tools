import { motion } from 'framer-motion'
import { WatermarkForm } from './WatermarkForm'
import { ResultCard } from './ResultCard'
import { useWatermarkStore } from '../../store/useWatermarkStore'

export default function WatermarkFeature() {
  const { status, result, error } = useWatermarkStore((state) => ({
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
          <h2 className="text-3xl font-semibold text-white">自定义水印</h2>
          <p className="text-white/70">
            上传一张照片，我们会根据当前日期、时间、星期以及你提供的地点和温度信息，自动生成符合「今日水印」风格的贴纸并叠加到图片上。
            系统会自动选择黑/白背景样式，保证水印在不同场景下都清晰易读。
          </p>
          <WatermarkForm />
        </div>
        <div className="flex-1">
          <ResultCard status={status} result={result} error={error} />
        </div>
      </div>
    </motion.div>
  )
}
