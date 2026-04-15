import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/pet-mosaic-wall/',
  server: {
    port: 55810,
    host: '0.0.0.0',
    allowedHosts: ['.titan.mihoyo.com'],
  },
})
