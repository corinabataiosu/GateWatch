import { Html } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import type {
  CameraDemonstrativa,
  IdentificatorCamera,
  ScenariuCamera,
} from '../../tipuri/camera'

type Pozitie3D = [number, number, number]

const IDENTIFICATOR_IMPLICIT: IdentificatorCamera = 'CAM-01'
const POZITIE_IMPLICIT: Pozitie3D = [4.4, 0, -5.6]
const PRAG_DEPLASARE_PX = 6

type PaletaStare = {
  inel: string
  corp: string
  activ: string
}

// Culori de prezentare pentru scenariul curent: albastru (normal), roșu (avertizare), gri (offline).
const PALETE_STARE: Record<ScenariuCamera, PaletaStare> = {
  normal: { inel: '#6d94b8', corp: '#3f78a8', activ: '#2f6c9e' },
  avertizare: { inel: '#c0564a', corp: '#b04a3f', activ: '#8f3831' },
  offline: { inel: '#a9b3c0', corp: '#8a99aa', activ: '#6b7787' },
}

const DETALII_FINISAJ = {
  placa: '#e3ebf4',
  suport: '#5c7889',
  obiectiv: '#33465a',
  reflectie: '#a8c6dd',
}

type ProprietatiMarkerCamera = {
  identificator?: IdentificatorCamera
  pozitie?: Pozitie3D
  selectat?: boolean
  // Starea curentă a camerei, primită din sursa unică a panoului principal.
  stare?: CameraDemonstrativa | null
  onSelecteaza?: (identificator: IdentificatorCamera) => void
}

export function MarkerCamera({
  identificator = IDENTIFICATOR_IMPLICIT,
  pozitie = POZITIE_IMPLICIT,
  selectat = false,
  stare = null,
  onSelecteaza,
}: ProprietatiMarkerCamera) {
  const pozitiePointer = useRef({ x: 0, y: 0 })
  const scenariuActiv: ScenariuCamera = stare?.scenariu ?? 'normal'
  const paleta = PALETE_STARE[scenariuActiv]

  useEffect(() => {
    return () => {
      document.body.style.cursor = ''
    }
  }, [])

  const laPointerJos = (eveniment: ThreeEvent<PointerEvent>) => {
    pozitiePointer.current = {
      x: eveniment.nativeEvent.clientX,
      y: eveniment.nativeEvent.clientY,
    }
  }

  const laSelectie = (eveniment: ThreeEvent<MouseEvent>) => {
    const { clientX, clientY } = eveniment.nativeEvent
    const deplasare = Math.hypot(
      clientX - pozitiePointer.current.x,
      clientY - pozitiePointer.current.y,
    )
    if (deplasare > PRAG_DEPLASARE_PX) {
      return
    }

    eveniment.stopPropagation()
    onSelecteaza?.(identificator)
  }

  const laDeasupra = () => {
    document.body.style.cursor = 'pointer'
  }

  const laPlecare = () => {
    document.body.style.cursor = ''
  }

  return (
    <group position={pozitie}>
      <mesh receiveShadow position={[0, 0.03, 0]}>
        <cylinderGeometry args={[0.5, 0.55, 0.06, 24]} />
        <meshStandardMaterial color={DETALII_FINISAJ.placa} roughness={0.9} />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.07, 0]}>
        <torusGeometry args={[0.44, 0.04, 10, 32]} />
        <meshStandardMaterial
          color={selectat ? paleta.activ : paleta.inel}
          roughness={0.6}
        />
      </mesh>

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
        <meshStandardMaterial
          color={selectat ? paleta.activ : paleta.corp}
          roughness={0.45}
        />
      </mesh>

      <mesh position={[0, 1.78, -0.2]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.09, 0.09, 0.08, 16]} />
        <meshStandardMaterial color={DETALII_FINISAJ.obiectiv} roughness={0.35} />
      </mesh>
      <mesh position={[0, 1.78, -0.25]}>
        <sphereGeometry args={[0.05, 10, 10]} />
        <meshStandardMaterial
          color={DETALII_FINISAJ.reflectie}
          roughness={0.2}
        />
      </mesh>

      {selectat && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.075, 0]}>
          <ringGeometry args={[0.56, 0.7, 32]} />
          <meshBasicMaterial
            color={paleta.activ}
            transparent
            opacity={0.35}
          />
        </mesh>
      )}

      <Html
        position={[0, 2.3, 0]}
        center
        zIndexRange={[2, 0]}
        style={{ pointerEvents: 'none' }}
      >
        <span
          className={`marker-camera__eticheta${selectat ? ' marker-camera__eticheta--activ' : ''}`}
        >
          {identificator}
        </span>
      </Html>

      <mesh
        onPointerDown={laPointerJos}
        onPointerOver={laDeasupra}
        onPointerOut={laPlecare}
        onClick={laSelectie}
        position={[0, 1.25, 0]}
      >
        <cylinderGeometry args={[0.85, 0.85, 2.5, 8]} />
        <meshStandardMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  )
}
