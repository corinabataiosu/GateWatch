import { SCENARII_CAMERA_SIMULATE } from '../dateSimulate/cameraSimulata'
import type { CameraDemonstrativa, ScenariuCamera } from '../tipuri/camera'

const SCENARII_DISPONIBILE: readonly ScenariuCamera[] = [
  'normal',
  'avertizare',
  'offline',
]

function cloneazaCamera(camera: CameraDemonstrativa): CameraDemonstrativa {
  return {
    ...camera,
    detectieAnomalii: { ...camera.detectieAnomalii },
    alerte: camera.alerte.map((alerta) => ({ ...alerta })),
  }
}

/**
 * Returnează o copie a stării simulate pentru scenariul cerut.
 * Copia protejează datele sursă de modificările făcute în interfață.
 */
export function obtineCameraDemonstrativa(
  scenariu: ScenariuCamera = 'normal',
): CameraDemonstrativa {
  return cloneazaCamera(SCENARII_CAMERA_SIMULATE[scenariu])
}

/** Returnează scenariile disponibile pentru camera demonstrativă. */
export function obtineScenariiDisponibile(): ScenariuCamera[] {
  return [...SCENARII_DISPONIBILE]
}

/** Returnează starea normală a camerei demonstrative. */
export function obtineCameraNormala(): CameraDemonstrativa {
  return obtineCameraDemonstrativa('normal')
}

/** Verifică dacă o valoare primită din exterior este un scenariu valid. */
export function esteScenariuCamera(valoare: string): valoare is ScenariuCamera {
  return (SCENARII_DISPONIBILE as readonly string[]).includes(valoare)
}
