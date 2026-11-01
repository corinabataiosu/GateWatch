import { useEffect, useState } from 'react'
import { anteteAdmin } from '../../servicii/clientSoc'

type Status = { state: string; message: string; calibrated: boolean }

export function CalibrareCamera({ onPornire }: { onPornire: () => void }) {
  const [status, setStatus] = useState<Status | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    const refresh = async () => {
      try {
        const response = await fetch('/__agent-video/stare')
        if (!response.ok) throw new Error('Starea calibrării nu este disponibilă.')
        const value: Status = await response.json()
        if (active) setStatus(value)
      } catch { if (active) setError('Controlul calibrării nu este disponibil pe acest server.') }
    }
    void refresh()
    const interval = setInterval(() => void refresh(), 2000)
    return () => { active = false; clearInterval(interval) }
  }, [])
  const start = async () => {
    setBusy(true); setError('')
    try {
      const response = await fetch('/__agent-video/calibreaza', { method: 'POST', headers: anteteAdmin() })
      const result = await response.json()
      if (!response.ok) throw new Error(result.detail)
      onPornire()
      setStatus({ ...result, calibrated: status?.calibrated ?? false })
    } catch (e) { setError(e instanceof Error ? e.message : 'Calibrarea a eșuat.') }
    finally { setBusy(false) }
  }
  return <div className="flux-camera__nota">
    <p>Calibrează doar cu obiectivul descoperit, în scena normală de demonstrație.
      Captura durează aproximativ 150 de secunde; modelul anterior este păstrat dacă validarea eșuează.</p>
    <button className="buton-actiune" disabled={!status || busy || status.state === 'running'} onClick={() => void start()}>
      {status?.state === 'running' ? 'Calibrare în curs…' : 'Calibrează pentru această scenă'}
    </button>
    <p role="status">{error || status?.message || (status?.calibrated ? 'Model de cameră disponibil.' : 'Necesită calibrare.')}</p>
  </div>
}
