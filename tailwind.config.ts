import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/web/index.html',
    './src/web/**/*.{ts,tsx}'
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui'],
        body: ['"Inter"', 'ui-sans-serif', 'system-ui']
      },
      colors: {
        brand: {
          light: '#a855f7',
          DEFAULT: '#7c3aed',
          dark: '#4338ca'
        }
      },
      boxShadow: {
        brand: '0 25px 50px -12px rgba(124, 58, 237, 0.45)'
      }
    }
  },
  plugins: []
}

export default config
