import { lazy, Suspense } from 'react'
import { motion } from 'framer-motion'
import { ToolsGrid } from './components/ToolsGrid'
import { Hero } from './components/Hero'

const AudioConvertFeature = lazy(() => import('./features/audio-convert'))

function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-sky-500">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-12">
        <Hero />
        <motion.section
          className="mt-12"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <ToolsGrid />
        </motion.section>
        <section className="mt-16" id="audio-convert">
          <Suspense fallback={<div className="text-center text-lg">加载音频转换器...</div>}>
            <AudioConvertFeature />
          </Suspense>
        </section>
      </div>
    </div>
  )
}

export default App
