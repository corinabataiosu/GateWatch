import { useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { ModelAeroport } from './ModelAeroport'

export function ScenaAeroport() {
  const [scenaPregatita, setScenaPregatita] = useState(false)

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
        <ModelAeroport />
      </Canvas>

      <span className="scena-aeroport__eticheta">
        Model schematic al aeroportului
      </span>
      <span className="scena-aeroport__indiciu" aria-hidden="true">
        Rotește și apropie pentru explorare
      </span>

      {!scenaPregatita && (
        <div className="scena-aeroport__incarcare" role="status">
          <span className="scena-aeroport__spinner" aria-hidden="true" />
          <span>Se inițializează scena 3D...</span>
        </div>
      )}
    </div>
  )
}
