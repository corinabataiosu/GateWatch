import { Html } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import type { Pozitie3D, TipDispozitiv } from './dispozitiveAeroport'

/** Starea afișată a unui dispozitiv în modelul 3D. */
export type StareVizuala = 'normal' | 'avertizare' | 'compromis' | 'indisponibil'

type PaletaStare = {
  inel: string
  corp: string
  activ: string
}

// Albastru (normal), chihlimbar (avertizare), roșu (compromis), gri (offline / izolat).
const PALETE_STARE: Record<StareVizuala, PaletaStare> = {
  normal: { inel: '#6b675f', corp: '#1d1d1d', activ: '#000000' },
  avertizare: { inel: '#c79b4f', corp: '#a8771f', activ: '#865e17' },
  compromis: { inel: '#c65a45', corp: '#b3361f', activ: '#8f2a18' },
  indisponibil: { inel: '#a9b3c0', corp: '#8a99aa', activ: '#6b7787' },
}

const DETALII_FINISAJ = {
  placa: '#e3ebf4',
  suport: '#5c7889',
  obiectiv: '#33465a',
  reflectie: '#a8c6dd',
  ecran: '#cfe0ee',
}

// Înălțimea etichetei deasupra fiecărui tip de dispozitiv.
const INALTIME_ETICHETA: Record<TipDispozitiv, number> = {
  camera: 2.3,
  nvr: 1.6,
  access_control: 1.9,
  iot_gateway: 2.1,
  vpn_gateway: 2.1,
}

const PRAG_DEPLASARE_PX = 6

type ProprietatiMarkerDispozitiv = {
  identificator: string
  tip: TipDispozitiv
  pozitie: Pozitie3D
  stare: StareVizuala
  selectat?: boolean
  onSelecteaza?: (identificator: string) => void
}

function CorpDispozitiv({ tip, paleta, selectat }: { tip: TipDispozitiv; paleta: PaletaStare; selectat: boolean }) {
  const culoare = selectat ? paleta.activ : paleta.corp

  switch (tip) {
    case 'camera':
      return (
        <>
          <mesh castShadow position={[0, 0.85, 0]}>
            <cylinderGeometry args={[0.05, 0.07, 1.6, 12]} />
            <meshStandardMaterial color={paleta.corp} roughness={0.55} />
          </mesh>
          <mesh castShadow position={[0, 1.62, 0.06]}>
            <boxGeometry args={[0.1, 0.26, 0.12]} />
            <meshStandardMaterial color={DETALII_FINISAJ.suport} roughness={0.6} />
          </mesh>
          <mesh castShadow position={[0, 1.78, 0]}>
            <boxGeometry args={[0.38, 0.26, 0.36]} />
            <meshStandardMaterial color={culoare} roughness={0.45} />
          </mesh>
          <mesh position={[0, 1.78, -0.2]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.09, 0.09, 0.08, 16]} />
            <meshStandardMaterial color={DETALII_FINISAJ.obiectiv} roughness={0.35} />
          </mesh>
          <mesh position={[0, 1.78, -0.25]}>
            <sphereGeometry args={[0.05, 10, 10]} />
            <meshStandardMaterial color={DETALII_FINISAJ.reflectie} roughness={0.2} />
          </mesh>
        </>
      )
    case 'nvr':
      // Rack cu trei unități de înregistrare.
      return (
        <>
          <mesh castShadow position={[0, 0.55, 0]}>
            <boxGeometry args={[0.7, 1, 0.55]} />
            <meshStandardMaterial color={culoare} roughness={0.5} />
          </mesh>
          {[0.3, 0.55, 0.8].map((y) => (
            <mesh key={y} position={[0, y, -0.28]}>
              <boxGeometry args={[0.58, 0.14, 0.02]} />
              <meshStandardMaterial color={DETALII_FINISAJ.obiectiv} roughness={0.4} />
            </mesh>
          ))}
        </>
      )
    case 'access_control':
      // Stâlp cu cititor de badge-uri.
      return (
        <>
          <mesh castShadow position={[0, 0.65, 0]}>
            <boxGeometry args={[0.22, 1.3, 0.16]} />
            <meshStandardMaterial color={culoare} roughness={0.5} />
          </mesh>
          <mesh position={[0, 1.05, -0.09]}>
            <boxGeometry args={[0.16, 0.24, 0.02]} />
            <meshStandardMaterial color={DETALII_FINISAJ.ecran} roughness={0.3} />
          </mesh>
        </>
      )
    case 'iot_gateway':
    case 'vpn_gateway':
      // Dulap de rețea cu antenă (IoT) sau cu două antene (VPN).
      return (
        <>
          <mesh castShadow position={[0, 0.45, 0]}>
            <boxGeometry args={[0.55, 0.8, 0.4]} />
            <meshStandardMaterial color={culoare} roughness={0.5} />
          </mesh>
          {(tip === 'vpn_gateway' ? [-0.15, 0.15] : [0]).map((x) => (
            <mesh key={x} castShadow position={[x, 1.2, 0]}>
              <cylinderGeometry args={[0.025, 0.025, 0.7, 8]} />
              <meshStandardMaterial color={DETALII_FINISAJ.suport} roughness={0.6} />
            </mesh>
          ))}
        </>
      )
  }
}

export function MarkerDispozitiv({
  identificator,
  tip,
  pozitie,
  stare,
  selectat = false,
  onSelecteaza,
}: ProprietatiMarkerDispozitiv) {
  const pozitiePointer = useRef({ x: 0, y: 0 })
  const paleta = PALETE_STARE[stare]

  useEffect(() => {
    return () => {
      document.body.style.cursor = ''
    }
  }, [])

  const laPointerJos = (eveniment: ThreeEvent<PointerEvent>) => {
    pozitiePointer.current = { x: eveniment.nativeEvent.clientX, y: eveniment.nativeEvent.clientY }
  }

  const laSelectie = (eveniment: ThreeEvent<MouseEvent>) => {
    const { clientX, clientY } = eveniment.nativeEvent
    // Un clic după o rotire a camerei nu selectează dispozitivul.
    if (Math.hypot(clientX - pozitiePointer.current.x, clientY - pozitiePointer.current.y) > PRAG_DEPLASARE_PX) {
      return
    }
    eveniment.stopPropagation()
    onSelecteaza?.(identificator)
  }

  return (
    <group position={pozitie}>
      <mesh receiveShadow position={[0, 0.03, 0]}>
        <cylinderGeometry args={[0.5, 0.55, 0.06, 24]} />
        <meshStandardMaterial color={DETALII_FINISAJ.placa} roughness={0.9} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.07, 0]}>
        <torusGeometry args={[0.44, 0.04, 10, 32]} />
        <meshStandardMaterial color={selectat ? paleta.activ : paleta.inel} roughness={0.6} />
      </mesh>
      {selectat && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.075, 0]}>
          <ringGeometry args={[0.56, 0.7, 32]} />
          <meshBasicMaterial color={paleta.activ} transparent opacity={0.35} />
        </mesh>
      )}

      <CorpDispozitiv tip={tip} paleta={paleta} selectat={selectat} />

      <Html position={[0, INALTIME_ETICHETA[tip], 0]} center zIndexRange={[2, 0]}>
        <button
          type="button"
          className={`marker-camera__eticheta marker-camera__eticheta--${stare}${selectat ? ' marker-camera__eticheta--activ' : ''}`}
          aria-pressed={selectat}
          onClick={() => onSelecteaza?.(identificator)}
        >
          {identificator}
        </button>
      </Html>

      {/* Zonă de clic invizibilă, mai mare decât dispozitivul. */}
      <mesh
        onPointerDown={laPointerJos}
        onPointerOver={() => (document.body.style.cursor = 'pointer')}
        onPointerOut={() => (document.body.style.cursor = '')}
        onClick={laSelectie}
        position={[0, 1, 0]}
      >
        <cylinderGeometry args={[0.85, 0.85, 2, 8]} />
        <meshStandardMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  )
}
