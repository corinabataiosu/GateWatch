import { SCENARII_CAMERA_SIMULATE } from '../dateSimulate/cameraSimulata'
import type {
  AlertaCamera,
  CameraDemonstrativa,
  IdentificatorAlerta,
  IdentificatorCamera,
  ScenariuCamera,
  SeveritateAlerta,
  StareSecuritate,
} from '../tipuri/camera'
import type { AlertaSoc, DispozitivSoc, SeveritateSoc } from '../tipuri/soc'

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

const SEVERITATI_DIN_SOC: Record<SeveritateSoc, SeveritateAlerta> = {
  low: 'informativa',
  medium: 'avertizare',
  high: 'critica',
  critical: 'critica',
}

function identificatorAlerta(valoare: string): IdentificatorAlerta {
  return valoare.startsWith('ALR-') ? (valoare as IdentificatorAlerta) : `ALR-${valoare}`
}

function scenariuDinSoc(dispozitiv: DispozitivSoc): ScenariuCamera {
  if (dispozitiv.operational_status !== 'online') {
    return 'offline'
  }
  return dispozitiv.security_state === 'warning' ||
    dispozitiv.security_state === 'compromised'
    ? 'avertizare'
    : 'normal'
}

function stareSecuritateDinSoc(dispozitiv: DispozitivSoc): StareSecuritate {
  switch (dispozitiv.security_state) {
    case 'normal':
      return 'normala'
    case 'warning':
      return 'avertizare'
    case 'compromised':
      return 'compromisa'
    default:
      return 'necunoscuta'
  }
}

/**
 * Construiește starea camerei pe baza datelor SOC.
 * SOC este autoritar pentru starea de securitate; metricile vizuale nu sunt furnizate
 * de SOC, așa că rămân indisponibile în loc să fie inventate.
 */
export function construiesteCameraDinSoc(
  dispozitiv: DispozitivSoc,
  alerteSoc: AlertaSoc[],
): CameraDemonstrativa {
  const alerteDeschise = alerteSoc
    .filter((alerta) => alerta.device_id === dispozitiv.device_id && alerta.status === 'open')
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
  const alertaMl = alerteDeschise.find((alerta) => alerta.source === 'ml')
  const conectata = dispozitiv.operational_status === 'online'

  const alerte: AlertaCamera[] = alerteDeschise.map((alerta) => ({
    identificator: identificatorAlerta(alerta.alert_id),
    cameraAsociata: dispozitiv.device_id as IdentificatorCamera,
    tip: 'detectie-soc',
    severitate: SEVERITATI_DIN_SOC[alerta.severity] ?? 'avertizare',
    mesaj: alerta.mitre
      ? `${alerta.title} — ${alerta.description} (${alerta.mitre.technique_id} ${alerta.mitre.technique})`
      : `${alerta.title} — ${alerta.description}`,
    dataOra: alerta.created_at,
    sursa: alerta.source === 'ml' ? 'ml' : 'regula',
  }))

  let descriere: string
  if (!conectata) {
    descriere =
      dispozitiv.operational_status === 'isolated'
        ? 'Dispozitivul este izolat de SOC; analiza evenimentelor este suspendată.'
        : 'Dispozitivul nu raportează evenimente; cauza nu este cunoscută.'
  } else if (alertaMl) {
    descriere = `Modelul ML al SOC a semnalat un comportament anormal: ${alertaMl.description}`
  } else {
    descriere = 'Modelul ML al SOC nu a semnalat comportament anormal pentru acest dispozitiv.'
  }

  return {
    identificator: dispozitiv.device_id as IdentificatorCamera,
    denumire: dispozitiv.name || `Camera ${dispozitiv.device_id}`,
    scenariu: scenariuDinSoc(dispozitiv),
    sursaDate: 'soc',
    stareConexiune: conectata ? 'conectata' : 'deconectata',
    disponibilitateFluxVideo: conectata ? 'disponibil' : 'intrerupt',
    stareSecuritate: stareSecuritateDinSoc(dispozitiv),
    ultimaActualizare: dispozitiv.last_seen ?? new Date().toISOString(),
    luminozitate: null,
    claritate: null,
    diferentaIntreCadre: null,
    detectieAnomalii: {
      disponibil: conectata,
      esteAnomalie: Boolean(alertaMl),
      scor: dispozitiv.ml?.score ?? alertaMl?.score ?? null,
      prag: dispozitiv.ml?.threshold ?? 0,
      descriere,
    },
    alerte,
  }
}
