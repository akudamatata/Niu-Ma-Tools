import { motion } from 'framer-motion'

const tools = [
  {
    name: '音频转 MP3',
    description: '浏览器内完成高质量 MP3 转码，安全又快速。',
    href: '#audio-convert',
    status: '可用'
  },
  {
    name: '12345台账分析',
    description: '自动匹配权属部门，并导出分析报表。',
    href: '#ledger-analysis',
    status: '可用'
  },
  {
    name: '音频合并',
    description: '多段音频一键拼接，自动对齐音量。',
    href: '#',
    status: '敬请期待'
  },
  {
    name: '音频降噪',
    description: '借助 AI 降噪，让声音更纯净。',
    href: '#',
    status: '敬请期待'
  },
  {
    name: '语音转文字',
    description: '调用 Workers AI Whisper，快速生成字幕文稿。',
    href: '#',
    status: '规划中'
  },
  {
    name: '视频提取音轨',
    description: '上传视频，提取音频素材。',
    href: '#',
    status: '规划中'
  }
]

export function ToolsGrid() {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {tools.map((tool, index) => (
        <motion.a
          key={tool.name}
          href={tool.href}
          target={tool.href.startsWith('#') ? undefined : '_blank'}
          rel="noreferrer"
          className="group flex flex-col rounded-2xl bg-white/10 p-6 text-white shadow-xl backdrop-blur transition hover:bg-white/20"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: index * 0.05 }}
        >
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold">{tool.name}</h3>
            <span className="rounded-full bg-white/20 px-3 py-1 text-xs uppercase tracking-widest">
              {tool.status}
            </span>
          </div>
          <p className="mt-3 text-sm text-white/80">{tool.description}</p>
          <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-sky-100 opacity-0 transition group-hover:opacity-100">
            查看详情
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M4 8H12M12 8L8.5 4.5M12 8L8.5 11.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </motion.a>
      ))}
    </div>
  )
}
