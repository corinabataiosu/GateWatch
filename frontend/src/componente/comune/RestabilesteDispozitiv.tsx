import { useRef, useState } from 'react'
import { restabilesteDispozitiv } from '../../servicii/clientSoc'

export function RestabilesteDispozitiv({ id, onRestabilit }: { id: string; onRestabilit: () => void }) {
  const [ocupat, setOcupat] = useState(false)
  const [mesaj, setMesaj] = useState('')
  const cerere = useRef<string | null>(null)
  const executa = async () => {
    if (ocupat) return
    setOcupat(true)
    setMesaj('')
    cerere.current ??= crypto.randomUUID()
    try {
      const rezultat = await restabilesteDispozitiv(id, cerere.current)
      setMesaj(`${id} restabilit. ${rezultat.closed_alerts} alerte închise. Monitorizarea continuă.`)
      cerere.current = null
      onRestabilit()
    } catch (error) {
      setMesaj(error instanceof Error ? error.message : 'Restabilirea a eșuat.')
    } finally {
      setOcupat(false)
    }
  }
  return <div onClick={event => event.stopPropagation()}>
    <button className="buton-actiune" disabled={ocupat} onClick={() => void executa()}>
      {ocupat ? 'Se restabilește…' : 'Restabilește dispozitivul'}
    </button>
    {mesaj && <p role="status">{mesaj}</p>}
  </div>
}
