import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { agentVideoLaCerere } from './dev/agentVideo.js'

export default defineConfig({
  plugins: [react(), agentVideoLaCerere()],
  server: { proxy: { '/api': 'http://127.0.0.1:8000' } },
})
