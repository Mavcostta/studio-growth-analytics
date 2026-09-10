import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    fs: {
      deny: [
        '.env',
        '.env.*',
        '**/.git/**',
        '**/credentials/**',
        '**/.snapshots/**',
        '**/*service-account*.json',
        '**/*service_account*.json',
        '**/*.{crt,pem,key}',
      ],
    },
    proxy: {
      '/api/history': { target: 'http://127.0.0.1:3001', changeOrigin: true },
      '/api/dev/analytics/test': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
      '/api/dev/instagram/posts': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
    },
  },
})
