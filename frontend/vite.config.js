import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    global: 'globalThis',
    'process.env': {},
  },
  resolve: {
    alias: {
      // Polyfill Node.js modules for browser
      util: 'util',
    },
  },
  build: {
    rollupOptions: {
      external: [],
      output: {
        globals: {
          'process': 'process',
          'global': 'globalThis'
        }
      }
    },
    target: 'esnext',
    minify: 'esbuild'
  },
  optimizeDeps: {
    include: [
      'ynab', 
      'firebase/app', 
      'firebase/auth', 
      'firebase/firestore',
      'react',
      'react-dom'
    ],
    exclude: []
  },
  server: {
    fs: {
      allow: ['..'],
    },
  },
})
