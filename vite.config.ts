import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  root: 'web',
  plugins: [react(), tailwindcss()],
  build: {
    outDir: '../dist/web',
    emptyOutDir: true,
  },
  server: {
    // In dev, the browser talks to Vite (5173); API calls are forwarded to Express.
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
})
