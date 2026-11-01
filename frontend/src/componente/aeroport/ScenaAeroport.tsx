import { useEffect, useMemo, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import {
  ETICHETE_ZONE,
  STARI_OPERATIONALE,
  STARI_SECURITATE_SOC,
  formateazaDataOra,
  stareSau,
} from '../../servicii/formatare'
import type { CameraDemonstrativa, ScenariuCamera, StareConexiune } from '../../tipuri/camera'
import type { DispozitivSoc } from '../../tipuri/soc'
import { DISPOZITIVE_AEROPORT, ETICHETE_TIP } from './dispozitiveAeroport'
import { ModelAeroport } from './ModelAeroport'
import type { StareVizuala } from './MarkerDispozitiv'

const IDENTIFICATOR_CAMERA_DETALIATA = 'CAM-01'

const ETICHETE_SCENARIU: Record<ScenariuCamera, string> = {
  normal: 'Funcționare normală',
  avertizare: 'Anomalie simulată',
  offline: 'Deconectare simulată',
}

const ETICHETE_CONEXIUNE: Record<StareConexiune, string> = {
  conectata: 'Conectată',
  instabila: 'Instabilă',
  deconectata: 'Deconectată',
}

const ETICHETE_STARE_VIZUALA: Record<StareVizuala, string> = {
  normal: 'Normală',
  avertizare: 'Avertizare',
  compromis: 'Compromis',
  indisponibil: 'Indisponibil',
}

function formateazaScor(valoare: number | null): string {
  if (valoare === null) {
    return 'indisponibil'
  }
  return valoare.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function descriereAnalizaMl(camera: CameraDemonstrativa): string | null {
  const detectie = camera.detectieAnomalii
  if (!detectie.disponibil) {
    // Fără flux video nu se atribuie un scor artificial.
    return null
  }
  const scor = formateazaScor(detectie.scor)
  const prag = formateazaScor(detectie.prag)
  if (camera.sursaDate === 'soc') {
    return detectie.esteAnomalie
      ? `Anomalie semnalată de SOC${detectie.scor === null ? '' : ` (scor ${scor} / prag ${prag})`}`
      : 'Fără anomalii semnalate de SOC'
  }
  return detectie.esteAnomalie
    ? `Anomalie detectată (scor ${scor} / prag ${prag})`
    : `Fără anomalii (scor ${scor} / prag ${prag})`
}

function stareDinSoc(dispozitiv: DispozitivSoc): StareVizuala {
  if (dispozitiv.operational_status !== 'online') {
    return 'indisponibil'
  }
  if (dispozitiv.security_state === 'compromised') {
    return 'compromis'
  }
  return dispozitiv.security_state === 'warning' ? 'avertizare' : 'normal'
}

function stareDinCamera(camera: CameraDemonstrativa): StareVizuala {
  if (camera.scenariu === 'offline') {
    return 'indisponibil'
  }
  if (camera.stareSecuritate === 'compromisa') {
    return 'compromis'
  }
  return camera.scenariu === 'avertizare' ? 'avertizare' : 'normal'
}

type ProprietatiScenaAeroport = {
  stareCamera?: CameraDemonstrativa | null
  /** Dispozitivele raportate de SOC; listă goală în modul demonstrativ. */
  dispozitiveSoc?: DispozitivSoc[]
}

export function ScenaAeroport({ stareCamera = null, dispozitiveSoc = [] }: ProprietatiScenaAeroport) {
  const [scenaPregatita, setScenaPregatita] = useState(false)
  const [identificatorSelectat, setIdentificatorSelectat] = useState<string | null>(null)

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

  const dupaId = useMemo(
    () => new Map(dispozitiveSoc.map((dispozitiv) => [dispozitiv.device_id, dispozitiv])),
    [dispozitiveSoc],
  )

  // SOC este autoritar pentru stare; CAM-01 urmează și scenariul demonstrativ când SOC lipsește.
  const stari = useMemo(() => {
    const rezultat: Record<string, StareVizuala> = {}
    for (const [id, dispozitiv] of dupaId) {
      rezultat[id] = stareDinSoc(dispozitiv)
    }
    if (stareCamera) {
      rezultat[IDENTIFICATOR_CAMERA_DETALIATA] = stareDinCamera(stareCamera)
    }
    return rezultat
  }, [dupaId, stareCamera])

  const selectat = DISPOZITIVE_AEROPORT.find((dispozitiv) => dispozitiv.id === identificatorSelectat)
  const dateSoc = selectat ? dupaId.get(selectat.id) : undefined
  const cameraDetaliata = selectat?.id === IDENTIFICATOR_CAMERA_DETALIATA ? stareCamera : null
  const analizaMl = cameraDetaliata ? descriereAnalizaMl(cameraDetaliata) : null

  return (
    <div className="scena-aeroport" role="group" aria-label="Model schematic tridimensional al aeroportului">
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [24, 52, 28], fov: 38, near: 0.5, far: 400 }}
        gl={{ antialias: true, alpha: false }}
        style={{ position: 'absolute', inset: 0 }}
        onCreated={({ gl }) => {
          gl.setClearColor('#ecebe6')
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
          stari={stari}
          onSelecteazaDispozitiv={setIdentificatorSelectat}
        />
      </Canvas>

      <span className="scena-aeroport__eticheta">Model schematic al aeroportului</span>
      <ul className="scena-aeroport__legenda" aria-label="Legendă">
        <li><i className="punct punct--normal" />Normal</li>
        <li><i className="punct punct--avertizare" />Avertizare</li>
        <li><i className="punct punct--compromis" />Compromis</li>
        <li><i className="punct punct--indisponibil" />Offline</li>
      </ul>
      <span className="scena-aeroport__indiciu" aria-hidden="true">
        Trage pentru rotire · scroll pentru zoom · apasă pe o etichetă pentru detalii
      </span>

      {selectat && (
        <aside className="marker-camera__panou" aria-label={`Detalii dispozitiv ${selectat.id}`}>
          <header className="marker-camera__panou-antet">
            <h3 className="marker-camera__panou-titlu">{selectat.id}</h3>
            <button
              type="button"
              className="marker-camera__panou-inchide"
              aria-label="Închide detaliile dispozitivului"
              onClick={() => setIdentificatorSelectat(null)}
            >
              ✕
            </button>
          </header>

          <dl className="marker-camera__panou-campuri">
            <Camp eticheta="Denumire" valoare={dateSoc?.name ?? selectat.denumire} />
            <Camp eticheta="Tip" valoare={ETICHETE_TIP[selectat.tip]} />
            <Camp eticheta="Zonă" valoare={ETICHETE_ZONE[selectat.zona] ?? selectat.zona} />
            <Camp eticheta="Amplasare" valoare={selectat.amplasare} />
            <Camp eticheta="Adresă" valoare={`${dateSoc?.ip ?? selectat.ip}:${selectat.port}`} />
            <Camp eticheta="Model" valoare={selectat.model} />
            <Camp eticheta="Firmware" valoare={selectat.firmware} />
            {dateSoc ? (
              <>
                <Camp
                  eticheta="Stare operațională"
                  valoare={stareSau(STARI_OPERATIONALE, dateSoc.operational_status).eticheta}
                />
                <Camp
                  eticheta="Stare securitate"
                  valoare={stareSau(STARI_SECURITATE_SOC, dateSoc.security_state).eticheta}
                />
                <Camp eticheta="Alerte deschise" valoare={String(dateSoc.open_alerts)} />
                <Camp eticheta="Ultima activitate" valoare={formateazaDataOra(dateSoc.last_seen)} />
              </>
            ) : (
              <Camp eticheta="Stare" valoare={ETICHETE_STARE_VIZUALA[stari[selectat.id] ?? 'normal']} />
            )}
            {cameraDetaliata && (
              <>
                <Camp eticheta="Conexiune" valoare={ETICHETE_CONEXIUNE[cameraDetaliata.stareConexiune]} />
                {!dateSoc && <Camp eticheta="Scenariu" valoare={ETICHETE_SCENARIU[cameraDetaliata.scenariu]} />}
                {analizaMl && <Camp eticheta="Analiză ML" valoare={analizaMl} />}
              </>
            )}
          </dl>

          <p className="marker-camera__panou-nota">
            {dateSoc
              ? 'Starea provine din SOC. Poziția în model este schematică.'
              : 'Date demonstrative (SOC indisponibil). Poziția în model este schematică.'}
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

function Camp({ eticheta, valoare }: { eticheta: string; valoare: string }) {
  return (
    <div className="marker-camera__panou-element">
      <dt>{eticheta}</dt>
      <dd>{valoare}</dd>
    </div>
  )
}
