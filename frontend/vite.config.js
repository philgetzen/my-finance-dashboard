import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    global: 'globalThis',
  },
  build: {
    target: 'esnext',
    minify: 'esbuild'
  },
  optimizeDeps: {
    include: [
      'firebase/app', 
      'firebase/auth', 
      'firebase/firestore',
      'react',
      'react-dom'
    ]
  },
  server: {
    https: false, // Keep as HTTP for local development - Firebase should handle this
    fs: {
      allow: ['..'],
    },
    host: true, // Allow external connections
  },
})
