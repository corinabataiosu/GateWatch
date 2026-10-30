import { useCallback, useMemo, useState } from 'react'
import {
  obtineCameraDemonstrativa,
  obtineScenariiDisponibile,
} from '../servicii/serviciuCamera'
import type { CameraDemonstrativa, ScenariuCamera } from '../tipuri/camera'

export type StareUseCameraDemonstrativa = {
  scenariu: ScenariuCamera
  camera: CameraDemonstrativa
  scenariiDisponibile: ScenariuCamera[]
  seteazaScenariu: (scenariu: ScenariuCamera) => void
  revinoLaNormal: () => void
}

/**
 * Expune starea camerei demonstrative și permite schimbarea scenariului.
 * Datele sunt obținute exclusiv prin serviciul de cameră.
 */
export function useCameraDemonstrativa(
  scenariuInitial: ScenariuCamera = 'normal',
): StareUseCameraDemonstrativa {
  const [scenariu, setScenariu] = useState<ScenariuCamera>(scenariuInitial)

  const camera = useMemo(
    () => obtineCameraDemonstrativa(scenariu),
    [scenariu],
  )

  const scenariiDisponibile = useMemo(() => obtineScenariiDisponibile(), [])

  const seteazaScenariu = useCallback((scenariuNou: ScenariuCamera) => {
    setScenariu(scenariuNou)
  }, [])

  const revinoLaNormal = useCallback(() => {
    setScenariu('normal')
  }, [])

  return {
    scenariu,
    camera,
    scenariiDisponibile,
    seteazaScenariu,
    revinoLaNormal,
  }
}
