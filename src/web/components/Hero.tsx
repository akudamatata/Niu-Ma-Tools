import { motion } from 'framer-motion'

export function Hero() {
  return (
    <motion.header
      className="flex flex-col items-center text-center"
      initial={{ opacity: 0, y: -30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7 }}
    >
      <span className="rounded-full bg-white/10 px-4 py-1 text-sm uppercase tracking-[0.35em] text-white/80">
        Niu-Ma-Tools
      </span>
      <h1 className="mt-6 bg-gradient-to-r from-sky-200 via-white to-fuchsia-200 bg-clip-text text-4xl font-bold text-transparent sm:text-5xl">
        你的影像与台账工具箱
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-white/80">
        基于 Cloudflare Workers 的全栈工具站。全新上线「今日水印」风格的自定义水印生成器与 12345 台账分析，自动识别权属部门并生成报表，更多能力持续迭代中。
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
        <a
          href="#ledger-analysis"
          className="rounded-full bg-white px-6 py-3 text-base font-semibold text-slate-900 shadow-brand transition hover:scale-105"
        >
          体验台账分析
        </a>
        <a
          href="#watermark"
          className="rounded-full bg-white/10 px-6 py-3 text-base font-semibold text-white/80 shadow-brand transition hover:scale-105 hover:bg-white/20"
        >
          体验自定义水印
        </a>
        <a
          href="https://github.com"
          className="rounded-full border border-white/40 px-6 py-3 text-base font-semibold text-white/80 transition hover:bg-white/10"
          target="_blank"
          rel="noreferrer"
        >
          查看 GitHub
        </a>
      </div>
    </motion.header>
  )
}
