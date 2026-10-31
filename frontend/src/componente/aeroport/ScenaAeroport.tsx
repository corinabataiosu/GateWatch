import { useEffect, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import type {
  CameraDemonstrativa,
  IdentificatorCamera,
  ScenariuCamera,
  StareConexiune,
} from '../../tipuri/camera'
import { ModelAeroport } from './ModelAeroport'

const DETALII_MARKER = {
  identificator: 'CAM-01' as IdentificatorCamera,
  zonaMonitorizata: 'Terminal — acces principal',
  tipDispozitiv: 'Cameră de supraveghere',
  descrierePozitie: 'Schematică, lângă intrarea principală a terminalului',
}

const ETICHETE_SCENARIU: Record<ScenariuCamera, string> = {
  normal: 'Funcționare normală',
  avertizare: 'Anomalie simulată',
  offline: 'Deconectare simulată',
}

const ETICHETE_STARE_SOC: Record<ScenariuCamera, string> = {
  normal: 'Fără activitate suspectă',
  avertizare: 'Activitate suspectă (SOC)',
  offline: 'Indisponibilă',
}

const ETICHETE_CONEXIUNE: Record<StareConexiune, string> = {
  conectata: 'Conectată',
  instabila: 'Instabilă',
  deconectata: 'Deconectată',
}

function formateazaScor(valoare: number | null): string {
  if (valoare === null) {
    return 'indisponibil'
  }
  return valoare.toLocaleString('ro-RO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function descriereAnalizaMl(
  camera: CameraDemonstrativa,
): string | null {
  const detectie = camera.detectieAnomalii

  if (!detectie.disponibil) {
    // Fără flux video nu se atribuie un scor artificial.
    return null
  }

  if (camera.sursaDate === 'soc') {
    return detectie.esteAnomalie
      ? `Anomalie semnalată de SOC${detectie.scor === null ? '' : ` (scor ${formateazaScor(detectie.scor)} / prag ${formateazaScor(detectie.prag)})`}`
      : 'Fără anomalii semnalate de SOC'
  }

  const scor = formateazaScor(detectie.scor)
  const prag = formateazaScor(detectie.prag)

  return detectie.esteAnomalie
    ? `Anomalie detectată (scor ${scor} / prag ${prag})`
    : `Fără anomalii (scor ${scor} / prag ${prag})`
}

type ProprietatiScenaAeroport = {
  stareCamera?: CameraDemonstrativa | null
}

export function ScenaAeroport({ stareCamera = null }: ProprietatiScenaAeroport) {
  const [scenaPregatita, setScenaPregatita] = useState(false)
  const [identificatorSelectat, setIdentificatorSelectat] =
    useState<IdentificatorCamera | null>(null)

  useEffect(() => {
    if (!identificatorSelectat) {
      return
    }

    const laTasta = (eveniment: KeyboardEvent) => {
      if (eveniment.key === 'Escape') {
        setIdentificatorSelectat(null)
      }
    }
    window.addEventListener('keydown', laTasta)
    return () => window.removeEventListener('keydown', laTasta)
  }, [identificatorSelectat])

  const panouDeschis = identificatorSelectat === DETALII_MARKER.identificator

  return (
    <div
      className="scena-aeroport"
      role="group"
      aria-label="Model schematic tridimensional al aeroportului"
    >
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [24, 52, 28], fov: 38, near: 0.5, far: 400 }}
        gl={{ antialias: true, alpha: false }}
        style={{ position: 'absolute', inset: 0 }}
        onCreated={({ gl }) => {
          gl.setClearColor('#f4f7fa')
          setScenaPregatita(true)
        }}
        fallback={
          <div className="scena-aeroport__fallback">
            <p>Scena 3D nu este disponibilă în acest browser.</p>
          </div>
        }
      >
        <ModelAeroport
          identificatorSelectat={identificatorSelectat}
          stareCamera={stareCamera}
          onSelecteazaCamera={(identificator) => setIdentificatorSelectat(identificator)}
        />
      </Canvas>

      <span className="scena-aeroport__eticheta">
        Model schematic al aeroportului
      </span>
      <span className="scena-aeroport__indiciu" aria-hidden="true">
        Rotește și apropie pentru explorare
      </span>

      {panouDeschis && (
        <aside
          className="marker-camera__panou"
          aria-label={`Detalii camera ${DETALII_MARKER.identificator}`}
        >
          <header className="marker-camera__panou-antet">
            <h3 className="marker-camera__panou-titlu">
              Camera {DETALII_MARKER.identificator}
            </h3>
            <button
              type="button"
              className="marker-camera__panou-inchide"
              aria-label="Închide detaliile camerei"
              onClick={() => setIdentificatorSelectat(null)}
            >
              ✕
            </button>
          </header>

          <dl className="marker-camera__panou-campuri">
            <div className="marker-camera__panou-element">
              <dt>Zonă monitorizată</dt>
              <dd>{DETALII_MARKER.zonaMonitorizata}</dd>
            </div>
            <div className="marker-camera__panou-element">
              <dt>Tip dispozitiv</dt>
              <dd>{DETALII_MARKER.tipDispozitiv}</dd>
            </div>
            {stareCamera && (
              <div className="marker-camera__panou-element">
                <dt>Stare conexiune</dt>
                <dd>{ETICHETE_CONEXIUNE[stareCamera.stareConexiune]}</dd>
              </div>
            )}
            {stareCamera && (
              <div className="marker-camera__panou-element">
                <dt>{stareCamera.sursaDate === 'soc' ? 'Stare securitate' : 'Stare scenariu'}</dt>
                <dd>
                  {stareCamera.sursaDate === 'soc'
                    ? ETICHETE_STARE_SOC[stareCamera.scenariu]
                    : ETICHETE_SCENARIU[stareCamera.scenariu]}
                </dd>
              </div>
            )}
            {stareCamera && descriereAnalizaMl(stareCamera) && (
              <div className="marker-camera__panou-element">
                <dt>Analiză ML</dt>
                <dd>{descriereAnalizaMl(stareCamera)}</dd>
              </div>
            )}
            <div className="marker-camera__panou-element">
              <dt>Poziție în model</dt>
              <dd>{DETALII_MARKER.descrierePozitie}</dd>
            </div>
          </dl>

          <p className="marker-camera__panou-nota">
            Poziția este schematică și nu reprezintă amplasarea reală a
            dispozitivului în aeroport.
          </p>
        </aside>
      )}

      {!scenaPregatita && (
        <div className="scena-aeroport__incarcare" role="status">
          <span className="scena-aeroport__spinner" aria-hidden="true" />
          <span>Se inițializează scena 3D...</span>
        </div>
      )}
    </div>
  )
}
