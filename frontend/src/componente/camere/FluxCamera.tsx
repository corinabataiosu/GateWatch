import { useRef, useState } from 'react'
import { Card } from '../comune/ElementeSoc'

/** Fluxul MJPEG publicat de agentul video (ml/src/agent_video.py). */
const ADRESA_FLUX = import.meta.env.VITE_FLUX_CAM01_URL ?? 'http://127.0.0.1:8002/flux.mjpg'

type ProprietatiFluxCamera = {
  identificator: string
  deschis: boolean
  onSchimba: (deschis: boolean) => void
}

/** Afișează fluxul video live al camerei, la cerere. */
export function FluxCamera({ identificator, deschis, onSchimba }: ProprietatiFluxCamera) {
  const [indisponibil, setIndisponibil] = useState(false)
  // Cheia nouă la fiecare deschidere forțează reconectarea la flux.
  const [incercare, setIncercare] = useState(0)

  const [sePorneste, setSePorneste] = useState(false)
  const pornireIncercata = useRef(false)

  const deschide = async () => {
    pornireIncercata.current = true
    setIndisponibil(false)
    if (import.meta.env.DEV) {
      // Serverul de dezvoltare pornește agentul video pe webcam dacă nu rulează deja.
      setSePorneste(true)
      try {
        await fetch('/__agent-video/porneste', { method: 'POST' })
      } catch {
        // Dacă pornirea eșuează, imaginea de mai jos afișează starea „indisponibil”.
      } finally {
        setSePorneste(false)
      }
    }
    setIncercare((valoare) => valoare + 1)
    onSchimba(true)
  }

  return (
    <Card
      titlu={`Flux video ${identificator}`}
      actiuni={
        deschis ? (
          <button type="button" className="buton-actiune buton-actiune--secundar" onClick={() => onSchimba(false)}>
            Închide fluxul
          </button>
        ) : (
          <button type="button" className="buton-actiune" onClick={deschide} disabled={sePorneste}>
            {sePorneste ? 'Se pornește camera...' : 'Vezi fluxul'}
          </button>
        )
      }
    >
      {!deschis ? (
        <p className="flux-camera__nota">
          Apasă pe „Vezi fluxul” sau pe rândul {identificator} din tabel pentru imaginea live.
        </p>
      ) : indisponibil ? (
        <div className="flux-camera__indisponibil" role="status">
          <p>Fluxul video nu este disponibil.</p>
          <p className="flux-camera__nota">
            Verifică dacă webcam-ul nu e folosit de altă aplicație, apoi reîncearcă.
          </p>
          <button type="button" className="buton-actiune" onClick={deschide}>
            Reîncearcă
          </button>
        </div>
      ) : (
        <div className="flux-camera">
          <img
            key={incercare}
            className="flux-camera__imagine"
            src={`${ADRESA_FLUX}?t=${incercare}`}
            alt={`Imagine live de la camera ${identificator}`}
            onError={() => {
              // Deschis din tabel, fără pornire: se încearcă o dată pornirea camerei.
              if (import.meta.env.DEV && !pornireIncercata.current) {
                void deschide()
              } else {
                setIndisponibil(true)
              }
            }}
          />
          <span className="flux-camera__live">LIVE</span>
        </div>
      )}
    </Card>
  )
}
