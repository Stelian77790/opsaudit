import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#0A0A0A',
        surface: '#111111',
        border: '#1F1F1F',
        accent: {
          DEFAULT: '#F97316',
          hover: '#EA6C0A',
          dim: '#7C3A0A',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'orange-glow': '0 0 20px rgba(249, 115, 22, 0.1)',
        'orange-glow-lg': '0 0 40px rgba(249, 115, 22, 0.15)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-orange': 'pulseOrange 2s infinite',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: { '0%': { transform: 'translateY(10px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
        pulseOrange: { '0%, 100%': { boxShadow: '0 0 0 0 rgba(249,115,22,0.4)' }, '70%': { boxShadow: '0 0 0 10px rgba(249,115,22,0)' } },
      },
    },
  },
  plugins: [],
}
export default config
