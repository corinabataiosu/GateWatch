import { Html } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import type {
  CameraDemonstrativa,
  IdentificatorCamera,
} from '../../tipuri/camera'

type Pozitie3D = [number, number, number]

const IDENTIFICATOR_IMPLICIT: IdentificatorCamera = 'CAM-01'
const POZITIE_IMPLICIT: Pozitie3D = [4.4, 0, -5.6]
const PRAG_DEPLASARE_PX = 6

const CULORI_MARKER = {
  placa: '#e3ebf4',
  inel: '#6d94b8',
  inelActiv: '#2f6c9e',
  corp: '#3f78a8',
  suport: '#5c7889',
  obiectiv: '#33465a',
  refractie: '#a8c6dd',
}

type ProprietatiMarkerCamera = {
  identificator?: IdentificatorCamera
  pozitie?: Pozitie3D
  selectat?: boolean
  // Rezervat pentru sincronizarea ulterioară a stării camerei prin simulare.
  stare?: Partial<CameraDemonstrativa> | null
  onSelecteaza?: (identificator: IdentificatorCamera) => void
}

export function MarkerCamera({
  identificator = IDENTIFICATOR_IMPLICIT,
  pozitie = POZITIE_IMPLICIT,
  selectat = false,
  onSelecteaza,
}: ProprietatiMarkerCamera) {
  const pozitiePointer = useRef({ x: 0, y: 0 })

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
        <meshStandardMaterial color={CULORI_MARKER.placa} roughness={0.9} />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.07, 0]}>
        <torusGeometry args={[0.44, 0.04, 10, 32]} />
        <meshStandardMaterial
          color={selectat ? CULORI_MARKER.inelActiv : CULORI_MARKER.inel}
          roughness={0.6}
        />
      </mesh>

      <mesh castShadow position={[0, 0.85, 0]}>
        <cylinderGeometry args={[0.05, 0.07, 1.6, 12]} />
        <meshStandardMaterial color={CULORI_MARKER.corp} roughness={0.55} />
      </mesh>

      <mesh castShadow position={[0, 1.62, 0.06]}>
        <boxGeometry args={[0.1, 0.26, 0.12]} />
        <meshStandardMaterial color={CULORI_MARKER.suport} roughness={0.6} />
      </mesh>

      <mesh castShadow position={[0, 1.78, 0]}>
        <boxGeometry args={[0.38, 0.26, 0.36]} />
        <meshStandardMaterial
          color={selectat ? CULORI_MARKER.inelActiv : CULORI_MARKER.corp}
          roughness={0.45}
        />
      </mesh>

      <mesh position={[0, 1.78, -0.2]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.09, 0.09, 0.08, 16]} />
        <meshStandardMaterial color={CULORI_MARKER.obiectiv} roughness={0.35} />
      </mesh>
      <mesh position={[0, 1.78, -0.25]}>
        <sphereGeometry args={[0.05, 10, 10]} />
        <meshStandardMaterial
          color={CULORI_MARKER.refractie}
          roughness={0.2}
        />
      </mesh>

      {selectat && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.075, 0]}>
          <ringGeometry args={[0.56, 0.7, 32]} />
          <meshBasicMaterial
            color={CULORI_MARKER.inelActiv}
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
