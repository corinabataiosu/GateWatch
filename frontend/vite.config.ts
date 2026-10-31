import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // În dezvoltare, apelurile /api sunt redirecționate către backend-ul SOC.
    proxy: {
      '/api': 'http://127.0.0.1:8000',
    },
  },
})
