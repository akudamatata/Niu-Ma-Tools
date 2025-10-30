import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  root: 'src/web',
  plugins: [react()],
  build: {
    outDir: '../../dist',
    emptyOutDir: true
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src/web'),
      '@/components': path.resolve(__dirname, 'src/web/components'),
      '@/features': path.resolve(__dirname, 'src/web/features'),
      '@/store': path.resolve(__dirname, 'src/web/store'),
      '@/lib': path.resolve(__dirname, 'src/web/lib')
    }
  }
})
