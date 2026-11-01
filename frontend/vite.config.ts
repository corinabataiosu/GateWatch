import react from '@vitejs/plugin-react'
import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'

const RADACINA = resolve(import.meta.dirname, '..')
const ADRESA_FLUX = 'http://127.0.0.1:8002/flux.mjpg'

async function fluxActiv(): Promise<boolean> {
  const controler = new AbortController()
  const temporizator = setTimeout(() => controler.abort(), 800)
  try {
    const raspuns = await fetch(ADRESA_FLUX, { signal: controler.signal })
    controler.abort()
    return raspuns.ok
  } catch {
    return false
  } finally {
    clearTimeout(temporizator)
  }
}

/**
 * Doar în dezvoltare: POST /__agent-video/porneste pornește agentul video pe webcam-ul
 * laptopului (dacă nu rulează deja), ca „Vezi fluxul” să funcționeze fără un terminal separat.
 * Indexul camerei: variabila GW_CAMERA_INDEX (implicit 0).
 */
function agentVideoLaCerere(): Plugin {
  let agent: ChildProcess | null = null

  return {
    name: 'gatewatch-agent-video',
    apply: 'serve',
    configureServer(server) {
      server.httpServer?.once('close', () => agent?.kill())

      server.middlewares.use('/__agent-video/porneste', async (cerere, raspuns) => {
        if (cerere.method !== 'POST') {
          raspuns.statusCode = 405
          raspuns.end()
          return
        }
        if (!(await fluxActiv()) && (agent === null || agent.exitCode !== null)) {
          const modelCamera = resolve(RADACINA, 'ml/models/video_camera.joblib')
          const argumente = [
            'ml/src/agent_video.py', '--sursa', 'camera',
            '--camera', process.env.GW_CAMERA_INDEX ?? '0', '--fps', '5',
            ...(existsSync(modelCamera) ? ['--model', modelCamera] : []),
          ]
          agent = spawn('python', argumente, { cwd: RADACINA, stdio: 'inherit' })
          agent.on('error', (eroare) => server.config.logger.error(`Agentul video nu a pornit: ${eroare.message}`))
        }
        for (let pas = 0; pas < 30 && !(await fluxActiv()); pas++) {
          await new Promise((gata) => setTimeout(gata, 500))
        }
        const activ = await fluxActiv()
        raspuns.statusCode = activ ? 200 : 503
        raspuns.setHeader('Content-Type', 'application/json')
        raspuns.end(JSON.stringify({ activ }))
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), agentVideoLaCerere()],
  server: {
    // În dezvoltare, apelurile /api sunt redirecționate către backend-ul SOC.
    proxy: {
      '/api': 'http://127.0.0.1:8000',
    },
  },
})
