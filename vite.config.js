import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Use absolute base paths for production (important on Vercel)
  base: '/',
  build: {
    outDir: 'dist',
    sourcemap: false
  },
  server: {
    port: 3000
  },
  eslint: {
    ignoreDuringBuilds: true
  }
})
