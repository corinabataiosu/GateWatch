import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Plugin } from 'vite'

const ROOT = resolve(import.meta.dirname, '../..')
const MODEL = resolve(ROOT, 'ml/models/video_camera.joblib')
const TOKEN = process.env.GATEWATCH_ADMIN_TOKEN ?? 'gatewatch-admin'
const CAMERA = process.env.GW_CAMERA_INDEX ?? '0'

async function streamActive(): Promise<boolean> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 800)
  try {
    const response = await fetch('http://127.0.0.1:8002/cadru.jpg', { signal: controller.signal })
    await response.body?.cancel()
    return response.ok
  } catch { return false } finally { clearTimeout(timer) }
}

function calibrated(): boolean {
  try {
    const card = JSON.parse(readFileSync(MODEL.replace('.joblib', '_card.json'), 'utf8'))
    return existsSync(MODEL) && card.sursa === 'camera' && card.fps === 5
      && card.validation?.accepted === true && card.reference_sharpness > 0
      && (card.camera_index === undefined || card.camera_index === Number(CAMERA))
  } catch { return false }
}

export function agentVideoLaCerere(): Plugin {
  let agent: ChildProcess | null = null
  let calibration: ChildProcess | null = null
  let busy = false
  let job = { state: 'idle', message: '' }

  return {
    name: 'gatewatch-local-video', apply: 'serve',
    configureServer(server) {
      server.httpServer?.once('close', () => { agent?.kill(); calibration?.kill() })
      server.middlewares.use('/__agent-video', async (request, response) => {
        const send = (status: number, data: unknown) => {
          response.statusCode = status
          response.setHeader('Content-Type', 'application/json')
          response.end(JSON.stringify(data))
        }
        if (request.url === '/stare' && request.method === 'GET') {
          send(200, { ...job, calibrated: calibrated() }); return
        }
        if (request.method !== 'POST') { send(405, { detail: 'Metodă nepermisă.' }); return }
        if (request.headers['x-admin-token'] !== TOKEN) { send(401, { detail: 'Token admin invalid.' }); return }
        if (busy || calibration) { send(409, { detail: 'Operație video în curs.' }); return }
        busy = true
        try {
          if (request.url === '/calibreaza') {
            if (agent) {
              const current = agent
              await new Promise<void>((accept, reject) => {
                const timer = setTimeout(() => reject(new Error('Agentul nu s-a oprit.')), 5000)
                current.once('exit', () => { clearTimeout(timer); accept() })
                current.kill()
              })
            }
            if (await streamActive()) {
              send(409, { detail: 'Oprește agentul pornit în terminal înainte de calibrare.' }); return
            }
            job = { state: 'running', message: 'Calibrare și validare: aproximativ 150 secunde. Păstrează scena normală.' }
            calibration = spawn('python', ['ml/src/calibrare_camera.py', '--camera', CAMERA, '--iesire', MODEL, '--capture-worker'],
              { cwd: ROOT, windowsHide: true, timeout: 255000, stdio: ['ignore', 'pipe', 'pipe'] })
            let output = ''
            calibration.stdout?.on('data', data => { output = (output + String(data)).slice(-2000) })
            calibration.stderr?.on('data', data => { output = (output + String(data)).slice(-2000) })
            calibration.once('error', error => { job = { state: 'failed', message: error.message }; calibration = null })
            calibration.once('close', code => {
              job = { state: code === 0 ? 'succeeded' : 'failed', message: code === 0
                ? 'Model validat și activat. Poți redeschide fluxul.'
                : 'Calibrarea a eșuat sau scena nu a trecut validarea. Modelul anterior a fost păstrat.' }
              if (code !== 0) server.config.logger.warn(output)
              calibration = null
            })
            send(202, job); return
          }
          if (request.url !== '/porneste') { send(404, { detail: 'Acțiune necunoscută.' }); return }
          if (!calibrated()) { send(409, { detail: 'Camera necesită calibrare. Modelul sintetic nu este folosit pentru webcam.' }); return }
          if (!(await streamActive()) && !agent) {
            agent = spawn('python', ['ml/src/agent_video.py', '--sursa', 'camera', '--camera', CAMERA,
              '--fps', '5', '--model', MODEL, '--token', TOKEN], { cwd: ROOT, windowsHide: true, stdio: 'inherit' })
            agent.once('error', error => { server.config.logger.error(error.message); agent = null })
            agent.once('exit', () => { agent = null })
          }
          for (let attempt = 0; attempt < 30 && !(await streamActive()); attempt++) {
            await new Promise(accept => setTimeout(accept, 500))
          }
          const active = await streamActive()
          send(active ? 200 : 503, { activ: active, detail: active ? '' : 'Webcam indisponibil. Verifică accesul și aplicațiile care îl folosesc.' })
        } catch (error) {
          send(500, { detail: error instanceof Error ? error.message : 'Operația video a eșuat.' })
        } finally { busy = false }
      })
    },
  }
}
