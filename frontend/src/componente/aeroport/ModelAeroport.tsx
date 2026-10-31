import { OrbitControls } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import {
  Box3,
  MathUtils,
  Mesh,
  Sphere,
  Vector3,
  type PerspectiveCamera,
} from 'three'
import { DISPOZITIVE_AEROPORT } from './dispozitiveAeroport'
import { MarkerDispozitiv, type StareVizuala } from './MarkerDispozitiv'

type ProprietatiModelAeroport = {
  identificatorSelectat?: string | null
  /** Starea afișată pentru fiecare dispozitiv; lipsa unei intrări înseamnă „normal”. */
  stari?: Record<string, StareVizuala>
  onSelecteazaDispozitiv?: (identificator: string) => void
}

type Pozitie3D = [number, number, number]

const DIRECTIE_VIZUALIZARE = new Vector3(24, 52, 28).normalize()

const CULORI = {
  sol: '#eef2f7',
  pista: '#5f6e80',
  caiRulare: '#9aa6b4',
  platforma: '#ccd3dc',
  delimitare: '#a9b3c0',
  drumServiciu: '#bfc7d2',
  cladire: '#f7f9fc',
  cladireSecundara: '#e9eef5',
  acoperis: '#d3dbe5',
  baza: '#b6c0cd',
  geam: '#7e9dae',
  geamInchis: '#5c7889',
  intrare: '#4d6474',
  marcaj: '#fbfdff',
  marcajGalben: '#d2a63f',
  detaliu: '#b8c3d2',
  aeronava: '#fbfcfe',
  aeronavaDetaliu: '#dbe3ec',
  antena: '#8a99aa',
}

function PistaAterizare() {
  const marcajeCentrale = Array.from(
    { length: 11 },
    (_, index) => -22 + index * 4.4,
  )
  const praguri = [-23, 23]
  const zoneAterizare = [-12, 12]

  return (
    <group>
      <mesh receiveShadow position={[0, 0.06, 13]}>
        <boxGeometry args={[50, 0.08, 4.6]} />
        <meshStandardMaterial color={CULORI.pista} roughness={0.94} />
      </mesh>

      <mesh position={[0, 0.11, 15.1]}>
        <boxGeometry args={[50, 0.02, 0.12]} />
        <meshStandardMaterial color={CULORI.marcaj} roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.11, 10.9]}>
        <boxGeometry args={[50, 0.02, 0.12]} />
        <meshStandardMaterial color={CULORI.marcaj} roughness={0.85} />
      </mesh>

      {marcajeCentrale.map((x) => (
        <mesh key={`marcaj-pista-${x}`} position={[x, 0.11, 13]}>
          <boxGeometry args={[2.2, 0.02, 0.16]} />
          <meshStandardMaterial color={CULORI.marcaj} roughness={0.85} />
        </mesh>
      ))}

      {praguri.map((x) => (
        <group key={`prag-${x}`}>
          {[-1.35, -0.45, 0.45, 1.35].map((decalaj) => (
            <mesh
              key={`prag-${x}-${decalaj}`}
              position={[x, 0.11, 13 + decalaj]}
            >
              <boxGeometry args={[1.7, 0.02, 0.16]} />
              <meshStandardMaterial color={CULORI.marcaj} roughness={0.85} />
            </mesh>
          ))}
        </group>
      ))}

      {zoneAterizare.map((x) => (
        <group key={`zona-${x}`}>
          {[-1.55, 1.55].map((decalaj) => (
            <mesh
              key={`zona-${x}-${decalaj}`}
              position={[x, 0.11, 13 + decalaj]}
            >
              <boxGeometry args={[1.1, 0.02, 0.3]} />
              <meshStandardMaterial color={CULORI.marcaj} roughness={0.85} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}

function CaiDeRulare() {
  const conectori = [-15, 0, 15]
  const marcaje = Array.from({ length: 13 }, (_, index) => -21 + index * 3.5)
  const marcajeConector = [-1.6, 1.6]

  return (
    <group>
      <mesh receiveShadow position={[0, 0.055, 6.5]}>
        <boxGeometry args={[44, 0.07, 1.9]} />
        <meshStandardMaterial color={CULORI.caiRulare} roughness={0.94} />
      </mesh>

      {[-1.65, 1.65].map((z) => (
        <mesh key={`muchie-cale-${z}`} position={[0, 0.1, 6.5 + z]}>
          <boxGeometry args={[44, 0.02, 0.07]} />
          <meshStandardMaterial
            color={CULORI.marcajGalben}
            roughness={0.85}
          />
        </mesh>
      ))}

      {marcaje.map((x) => (
        <mesh key={`marcaj-cale-${x}`} position={[x, 0.1, 6.5]}>
          <boxGeometry args={[1.6, 0.02, 0.12]} />
          <meshStandardMaterial color={CULORI.marcajGalben} roughness={0.85} />
        </mesh>
      ))}

      {conectori.map((x) => (
        <group key={`conector-${x}`}>
          <mesh receiveShadow position={[x, 0.055, 9.75]}>
            <boxGeometry args={[1.6, 0.07, 6.5]} />
            <meshStandardMaterial color={CULORI.caiRulare} roughness={0.94} />
          </mesh>
          {marcajeConector.map((z) => (
            <mesh
              key={`marcaj-conector-${x}-${z}`}
              position={[x, 0.1, 9.75 + z]}
            >
              <boxGeometry args={[0.12, 0.02, 6.1]} />
              <meshStandardMaterial
                color={CULORI.marcajGalben}
                roughness={0.85}
              />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}

function PlatformaAeronave() {
  const liniiStand = [-8, 0, 8]
  const imbinariX = [-12, 0, 12]
  const imbinariZ = [-7, -2.5, 2]
  const echipamente: { pozitie: Pozitie3D; dimensiuni: Pozitie3D }[] = [
    { pozitie: [-4.2, 0, 2.9], dimensiuni: [1.5, 0.55, 0.8] },
    { pozitie: [4.4, 0, 2.7], dimensiuni: [1, 0.65, 0.7] },
  ]

  return (
    <group>
      <mesh receiveShadow position={[0, 0.05, -2.5]}>
        <boxGeometry args={[36, 0.06, 12]} />
        <meshStandardMaterial color={CULORI.platforma} roughness={0.95} />
      </mesh>

      {imbinariX.map((x) => (
        <mesh key={`imbinare-x-${x}`} position={[x, 0.085, -2.5]}>
          <boxGeometry args={[0.05, 0.02, 11.6]} />
          <meshStandardMaterial color={CULORI.delimitare} roughness={0.9} />
        </mesh>
      ))}

      {imbinariZ.map((z) => (
        <mesh key={`imbinare-z-${z}`} position={[0, 0.085, z]}>
          <boxGeometry args={[35.6, 0.02, 0.05]} />
          <meshStandardMaterial color={CULORI.delimitare} roughness={0.9} />
        </mesh>
      ))}

      {liniiStand.map((x) => (
        <group key={`stand-${x}`}>
          <mesh position={[x, 0.095, 0.6]}>
            <boxGeometry args={[0.12, 0.02, 5.2]} />
            <meshStandardMaterial color={CULORI.marcaj} roughness={0.85} />
          </mesh>
          <mesh position={[x, 0.095, 3.2]}>
            <boxGeometry args={[3.4, 0.02, 0.12]} />
            <meshStandardMaterial
              color={CULORI.marcajGalben}
              roughness={0.85}
            />
          </mesh>
        </group>
      ))}

      <mesh receiveShadow position={[0, 0.09, 3.9]}>
        <boxGeometry args={[34.5, 0.035, 1.1]} />
        <meshStandardMaterial color={CULORI.drumServiciu} roughness={0.94} />
      </mesh>
      {[-6, -3, 0, 3, 6].map((x) => (
        <mesh key={`dash-serviciu-${x}`} position={[x, 0.11, 3.9]}>
          <boxGeometry args={[1.5, 0.02, 0.08]} />
          <meshStandardMaterial color={CULORI.marcaj} roughness={0.85} />
        </mesh>
      ))}

      {echipamente.map(({ pozitie, dimensiuni }, index) => (
        <mesh
          key={`echipament-${index}`}
          castShadow
          receiveShadow
          position={[pozitie[0], pozitie[1] + dimensiuni[1] / 2, pozitie[2]]}
        >
          <boxGeometry args={dimensiuni} />
          <meshStandardMaterial
            color={CULORI.aeronavaDetaliu}
            roughness={0.9}
          />
        </mesh>
      ))}
    </group>
  )
}

function Terminal() {
  const mullions = [-8, -6, -4, -2, 0, 2, 4, 6, 8]

  return (
    <group>
      <mesh position={[0, 0.22, -10.5]}>
        <boxGeometry args={[18.3, 0.44, 7.8]} />
        <meshStandardMaterial color={CULORI.baza} roughness={0.92} />
      </mesh>

      <mesh castShadow receiveShadow position={[0, 2.4, -10.5]}>
        <boxGeometry args={[18, 4.8, 7.6]} />
        <meshStandardMaterial color={CULORI.cladire} roughness={0.9} />
      </mesh>

      <mesh castShadow receiveShadow position={[-13.5, 1.7, -11]}>
        <boxGeometry args={[9, 3.4, 6.6]} />
        <meshStandardMaterial
          color={CULORI.cladireSecundara}
          roughness={0.9}
        />
      </mesh>
      <mesh castShadow receiveShadow position={[13.5, 1.7, -11]}>
        <boxGeometry args={[9, 3.4, 6.6]} />
        <meshStandardMaterial
          color={CULORI.cladireSecundara}
          roughness={0.9}
        />
      </mesh>

      <mesh castShadow position={[0, 4.95, -10.5]}>
        <boxGeometry args={[19.4, 0.35, 8.8]} />
        <meshStandardMaterial color={CULORI.acoperis} roughness={0.88} />
      </mesh>
      <mesh castShadow position={[-13.5, 3.55, -11]}>
        <boxGeometry args={[10, 0.3, 7.6]} />
        <meshStandardMaterial color={CULORI.acoperis} roughness={0.88} />
      </mesh>
      <mesh castShadow position={[13.5, 3.55, -11]}>
        <boxGeometry args={[10, 0.3, 7.6]} />
        <meshStandardMaterial color={CULORI.acoperis} roughness={0.88} />
      </mesh>

      <mesh position={[0, 2.2, -6.63]}>
        <boxGeometry args={[17.6, 2.4, 0.14]} />
        <meshStandardMaterial color={CULORI.geam} roughness={0.4} />
      </mesh>
      {mullions.map((x) => (
        <mesh key={`mullion-${x}`} position={[x, 2.2, -6.55]}>
          <boxGeometry args={[0.12, 2.4, 0.18]} />
          <meshStandardMaterial color={CULORI.detaliu} roughness={0.85} />
        </mesh>
      ))}

      <mesh position={[-9.5, 2.2, -6.5]}>
        <boxGeometry args={[1.4, 2.4, 0.2]} />
        <meshStandardMaterial color={CULORI.geamInchis} roughness={0.55} />
      </mesh>
      <mesh position={[9.5, 2.2, -6.5]}>
        <boxGeometry args={[1.4, 2.4, 0.2]} />
        <meshStandardMaterial color={CULORI.geamInchis} roughness={0.55} />
      </mesh>

      <mesh position={[-13.5, 1.8, -7.63]}>
        <boxGeometry args={[8.6, 1.8, 0.14]} />
        <meshStandardMaterial color={CULORI.geam} roughness={0.42} />
      </mesh>
      <mesh position={[13.5, 1.8, -7.63]}>
        <boxGeometry args={[8.6, 1.8, 0.14]} />
        <meshStandardMaterial color={CULORI.geam} roughness={0.42} />
      </mesh>

      <mesh castShadow position={[0, 3.2, -5.5]}>
        <boxGeometry args={[7, 0.25, 2.4]} />
        <meshStandardMaterial color={CULORI.acoperis} roughness={0.88} />
      </mesh>
      {[-3, 3].map((x) => (
        <mesh key={`coloana-${x}`} castShadow position={[x, 1.55, -4.5]}>
          <cylinderGeometry args={[0.12, 0.12, 3.1, 12]} />
          <meshStandardMaterial color={CULORI.detaliu} roughness={0.85} />
        </mesh>
      ))}

      <mesh position={[0, 1.1, -6.56]}>
        <boxGeometry args={[3.2, 2.1, 0.1]} />
        <meshStandardMaterial color={CULORI.intrare} roughness={0.6} />
      </mesh>
      {[-1.1, 0, 1.1].map((x) => (
        <mesh key={`usa-${x}`} position={[x, 0.55, -6.5]}>
          <boxGeometry args={[0.9, 1.1, 0.04]} />
          <meshStandardMaterial color={CULORI.geam} roughness={0.5} />
        </mesh>
      ))}

      <mesh castShadow position={[0, 5.35, -10.5]}>
        <boxGeometry args={[3.2, 0.8, 2]} />
        <meshStandardMaterial
          color={CULORI.cladireSecundara}
          roughness={0.9}
        />
      </mesh>

      {[-5, 5].map((x) => (
        <mesh key={`ava-${x}`} castShadow position={[x, 5.5, -10.5]}>
          <boxGeometry args={[0.6, 1.1, 0.6]} />
          <meshStandardMaterial color={CULORI.baza} roughness={0.9} />
        </mesh>
      ))}
    </group>
  )
}

function TurnControl() {
  return (
    <group position={[21, 0, -10]}>
      <mesh castShadow receiveShadow position={[0, 1.4, 0]}>
        <boxGeometry args={[2.6, 2.8, 2.6]} />
        <meshStandardMaterial
          color={CULORI.cladireSecundara}
          roughness={0.9}
        />
      </mesh>

      <mesh castShadow position={[0, 5.9, 0]}>
        <cylinderGeometry args={[0.78, 0.95, 6.2, 24]} />
        <meshStandardMaterial color={CULORI.cladire} roughness={0.88} />
      </mesh>

      <mesh position={[0, 9, 0]}>
        <cylinderGeometry args={[1.9, 1.9, 0.12, 24]} />
        <meshStandardMaterial color={CULORI.detaliu} roughness={0.88} />
      </mesh>

      <mesh castShadow position={[0, 9.7, 0]}>
        <cylinderGeometry args={[1.55, 1.7, 1.3, 24]} />
        <meshStandardMaterial color={CULORI.geamInchis} roughness={0.45} />
      </mesh>

      <mesh castShadow position={[0, 10.5, 0]}>
        <cylinderGeometry args={[1.95, 1.95, 0.3, 24]} />
        <meshStandardMaterial color={CULORI.acoperis} roughness={0.88} />
      </mesh>

      <mesh position={[0, 11.2, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 1.2, 8]} />
        <meshStandardMaterial color={CULORI.antena} roughness={0.6} />
      </mesh>
      <mesh position={[0, 11.85, 0]}>
        <sphereGeometry args={[0.1, 8, 8]} />
        <meshStandardMaterial color={CULORI.antena} roughness={0.6} />
      </mesh>
    </group>
  )
}

function Hangar() {
  return (
    <group position={[-23, 0, -8]}>
      <mesh castShadow receiveShadow position={[0, 1.7, 0]}>
        <boxGeometry args={[9, 3.4, 7]} />
        <meshStandardMaterial
          color={CULORI.cladireSecundara}
          roughness={0.9}
        />
      </mesh>

      <mesh castShadow position={[0, 3.55, 0]}>
        <boxGeometry args={[9.6, 0.3, 7.6]} />
        <meshStandardMaterial color={CULORI.acoperis} roughness={0.88} />
      </mesh>

      <mesh position={[0, 1.35, 3.53]}>
        <boxGeometry args={[5.8, 2.5, 0.14]} />
        <meshStandardMaterial color={CULORI.geamInchis} roughness={0.65} />
      </mesh>

      {[-2.4, 0, 2.4].map((x) => (
        <mesh key={`usa-hangar-${x}`} position={[x, 1.35, 3.62]}>
          <boxGeometry args={[0.08, 2.5, 0.08]} />
          <meshStandardMaterial color={CULORI.marcaj} roughness={0.85} />
        </mesh>
      ))}
    </group>
  )
}

function Aeronava({ pozitie }: { pozitie: Pozitie3D }) {
  return (
    <group position={pozitie}>
      <mesh castShadow position={[0, 0.6, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.36, 0.36, 3.8, 18]} />
        <meshStandardMaterial
          color={CULORI.aeronava}
          roughness={0.6}
        />
      </mesh>

      <mesh castShadow position={[1.9, 0.6, 0]} scale={[1.7, 1, 1]}>
        <sphereGeometry args={[0.36, 18, 14]} />
        <meshStandardMaterial color={CULORI.aeronava} roughness={0.6} />
      </mesh>

      <mesh
        castShadow
        position={[-2.05, 0.6, 0]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <cylinderGeometry args={[0.1, 0.36, 1.2, 18]} />
        <meshStandardMaterial color={CULORI.aeronava} roughness={0.6} />
      </mesh>

      <mesh position={[0, 0.42, 0]}>
        <boxGeometry args={[3.2, 0.16, 0.73]} />
        <meshStandardMaterial color={CULORI.geamInchis} roughness={0.5} />
      </mesh>

      <mesh castShadow position={[0.15, 0.52, 1.95]} rotation={[0, -0.42, 0]}>
        <boxGeometry args={[1.3, 0.09, 4.6]} />
        <meshStandardMaterial color={CULORI.aeronavaDetaliu} roughness={0.7} />
      </mesh>
      <mesh castShadow position={[0.15, 0.52, -1.95]} rotation={[0, 0.42, 0]}>
        <boxGeometry args={[1.3, 0.09, 4.6]} />
        <meshStandardMaterial color={CULORI.aeronavaDetaliu} roughness={0.7} />
      </mesh>

      {[-1.35, 1.35].map((z) => (
        <mesh
          key={`motor-${z}`}
          castShadow
          position={[0.3, 0.28, z]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <cylinderGeometry args={[0.19, 0.19, 0.9, 14]} />
          <meshStandardMaterial color={CULORI.aeronavaDetaliu} roughness={0.7} />
        </mesh>
      ))}

      <mesh castShadow position={[-2.25, 1.2, 0]} rotation={[0, 0, 0.22]}>
        <boxGeometry args={[1.35, 1.3, 0.1]} />
        <meshStandardMaterial color={CULORI.geam} roughness={0.65} />
      </mesh>
      <mesh castShadow position={[-2.15, 0.72, 0.8]} rotation={[0, -0.45, 0]}>
        <boxGeometry args={[0.65, 0.07, 1.9]} />
        <meshStandardMaterial color={CULORI.aeronavaDetaliu} roughness={0.7} />
      </mesh>
      <mesh castShadow position={[-2.15, 0.72, -0.8]} rotation={[0, 0.45, 0]}>
        <boxGeometry args={[0.65, 0.07, 1.9]} />
        <meshStandardMaterial color={CULORI.aeronavaDetaliu} roughness={0.7} />
      </mesh>
    </group>
  )
}

function Cadrare() {
  const { camera, scene, size, controls } = useThree()

  useEffect(() => {
    const cameraPerspectiva = camera as PerspectiveCamera
    const cutie = new Box3().setFromObject(scene)
    if (cutie.isEmpty()) {
      return
    }

    const sfera = cutie.getBoundingSphere(new Sphere())
    const centru = new Vector3(
      (cutie.min.x + cutie.max.x) / 2,
      (cutie.min.y + cutie.max.y) / 2,
      (cutie.min.z + cutie.max.z) / 2,
    )
    const aspect = size.width / Math.max(1, size.height)
    const unghiVertical = MathUtils.degToRad(cameraPerspectiva.fov) / 2
    const unghiOrizontal = Math.atan(Math.tan(unghiVertical) * aspect)

    scene.updateMatrixWorld(true)
    const puncteReferinta: Vector3[] = []
    scene.traverse((obiect) => {
      const obiectMesh = obiect as Mesh
      if (!obiectMesh.isMesh) {
        return
      }
      const atribut = obiectMesh.geometry.getAttribute('position')
      if (!atribut || atribut.count === 0) {
        return
      }
      const pas = Math.max(1, Math.floor(atribut.count / 192))
      for (let indice = 0; indice < atribut.count; indice += pas) {
        puncteReferinta.push(
          new Vector3()
            .fromBufferAttribute(atribut, indice)
            .applyMatrix4(obiectMesh.matrixWorld),
        )
      }
    })

    const punct = new Vector3()
    const limite = { minX: 0, maxX: 0, minY: 0, maxY: 0 }
    const tintaFinala = new Vector3()

    const masoaraProiectie = () => {
      limite.minX = Infinity
      limite.maxX = -Infinity
      limite.minY = Infinity
      limite.maxY = -Infinity

      for (const punctReferinta of puncteReferinta) {
        punct.copy(punctReferinta).project(cameraPerspectiva)
        if (punct.x < limite.minX) limite.minX = punct.x
        if (punct.x > limite.maxX) limite.maxX = punct.x
        if (punct.y < limite.minY) limite.minY = punct.y
        if (punct.y > limite.maxY) limite.maxY = punct.y
      }
    }

    const paseazaCamera = (distanta: number) => {
      punct.copy(DIRECTIE_VIZUALIZARE).multiplyScalar(distanta).add(tintaFinala)
      cameraPerspectiva.position.copy(punct)
      cameraPerspectiva.lookAt(tintaFinala)
      cameraPerspectiva.updateMatrixWorld(true)
    }

    const centreaza = (distanta: number) => {
      for (let pas = 0; pas < 8; pas++) {
        masoaraProiectie()
        const cx = (limite.minX + limite.maxX) / 2
        const cy = (limite.minY + limite.maxY) / 2
        if (Math.abs(cx) < 0.001 && Math.abs(cy) < 0.001) {
          break
        }
        const axaDreapta = new Vector3().setFromMatrixColumn(
          cameraPerspectiva.matrixWorld,
          0,
        )
        const axaSus = new Vector3().setFromMatrixColumn(
          cameraPerspectiva.matrixWorld,
          1,
        )
        const deplasare = new Vector3()
          .addScaledVector(
            axaDreapta,
            cx * 0.8 * distanta * Math.tan(unghiOrizontal),
          )
          .addScaledVector(
            axaSus,
            cy * 0.8 * distanta * Math.tan(unghiVertical),
          )
        cameraPerspectiva.position.add(deplasare)
        tintaFinala.add(deplasare)
        cameraPerspectiva.lookAt(tintaFinala)
        cameraPerspectiva.updateMatrixWorld(true)
      }
      masoaraProiectie()
    }

    const esteInMargina = () =>
      limite.maxX <= 0.96 &&
      limite.minX >= -0.96 &&
      limite.maxY <= 0.96 &&
      limite.minY >= -0.96

    let distantaCurenta =
      (sfera.radius /
        Math.max(
          Math.min(Math.sin(unghiVertical), Math.sin(unghiOrizontal)),
          0.001,
        )) *
      1.3
    const distantaMinima = sfera.radius * 1.5
    let distantaValida = distantaCurenta

    for (let pas = 0; pas < 16; pas++) {
      tintaFinala.copy(centru)
      paseazaCamera(distantaCurenta)
      centreaza(distantaCurenta)

      const latimeNdc = limite.maxX - limite.minX
      const inaltimeNdc = limite.maxY - limite.minY
      const majora = Math.max(latimeNdc, inaltimeNdc)
      const inMargina = esteInMargina()
      if (pas === 0) {
        console.log(
          '[cadrare-0]',
          JSON.stringify({
            min: cutie.min.toArray().map((v) => Number(v.toFixed(1))),
            max: cutie.max.toArray().map((v) => Number(v.toFixed(1))),
            raza: Number(sfera.radius.toFixed(1)),
            puncte: puncteReferinta.length,
          }),
        )
      }
      console.log(
        '[cadrare]',
        JSON.stringify({
          d: Number(distantaCurenta.toFixed(1)),
          majora: Number(majora.toFixed(2)),
          in: inMargina,
          tinta: tintaFinala.toArray().map((v) => Number(v.toFixed(1))),
        }),
      )

      if (inMargina) {
        distantaValida = distantaCurenta
        if (majora >= 1.92) {
          break
        }
        distantaCurenta = Math.max(
          distantaMinima,
          distantaCurenta * (majora / 1.92) * 0.95,
        )
      } else {
        distantaCurenta = distantaCurenta * 1.15
        continue
      }

      if (distantaCurenta === distantaValida) {
        break
      }
    }

    tintaFinala.copy(centru)
    paseazaCamera(distantaValida)
    centreaza(distantaValida)
    cameraPerspectiva.updateMatrixWorld(true)

    const orbital = controls as unknown as
      | { target: Vector3; update: () => void }
      | null
    if (orbital) {
      orbital.target.copy(tintaFinala)
      orbital.update()
    }
  }, [camera, scene, size, controls])

  return null
}

export function ModelAeroport({
  identificatorSelectat = null,
  stari = {},
  onSelecteazaDispozitiv,
}: ProprietatiModelAeroport) {
  return (
    <>
      <ambientLight intensity={0.55} />
      <hemisphereLight args={['#ffffff', '#dfe6ef', 0.5]} />
      <directionalLight
        castShadow
        position={[34, 46, 30]}
        intensity={1.9}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-46}
        shadow-camera-right={46}
        shadow-camera-top={46}
        shadow-camera-bottom={-46}
        shadow-camera-near={1}
        shadow-camera-far={140}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
      />
      <directionalLight
        position={[-30, 24, -26]}
        intensity={0.3}
        color="#dfe8f4"
      />

      <group>
        <mesh receiveShadow position={[0, -0.25, 0]}>
          <boxGeometry args={[68, 0.5, 46]} />
          <meshStandardMaterial color={CULORI.sol} roughness={0.98} />
        </mesh>

        <PistaAterizare />
        <CaiDeRulare />
        <PlatformaAeronave />
        <Terminal />
        <TurnControl />
        <Hangar />
        <Aeronava pozitie={[-8, 0.1, -1.5]} />
        <Aeronava pozitie={[8, 0.1, -1.5]} />

        {DISPOZITIVE_AEROPORT.map((dispozitiv) => (
          <MarkerDispozitiv
            key={dispozitiv.id}
            identificator={dispozitiv.id}
            tip={dispozitiv.tip}
            pozitie={dispozitiv.pozitie}
            stare={stari[dispozitiv.id] ?? 'normal'}
            selectat={identificatorSelectat === dispozitiv.id}
            onSelecteaza={onSelecteazaDispozitiv}
          />
        ))}
      </group>

      <Cadrare />

      <OrbitControls
        makeDefault
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        rotateSpeed={0.65}
        zoomSpeed={0.8}
        minDistance={45}
        maxDistance={160}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 2.08}
      />
    </>
  )
}
