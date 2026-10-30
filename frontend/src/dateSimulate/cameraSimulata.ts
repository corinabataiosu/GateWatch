import type {
  CameraDemonstrativa,
  IdentificatorCamera,
  ScenariuCamera,
} from '../tipuri/camera'

/**
 * Date simulate pentru camera demonstrativă CAM-01.
 * Valorile numerice sunt fictive, stabilite pentru demonstrație, și nu reprezintă măsurători reale.
 */

export const IDENTIFICATOR_CAMERA_DEMONSTRATIVA: IdentificatorCamera = 'CAM-01'

export const DENUMIRE_CAMERA_DEMONSTRATIVA = 'Camera demonstrativă CAM-01'

export const SCENARII_CAMERA_SIMULATE: Record<ScenariuCamera, CameraDemonstrativa> = {
  normal: {
    identificator: IDENTIFICATOR_CAMERA_DEMONSTRATIVA,
    denumire: DENUMIRE_CAMERA_DEMONSTRATIVA,
    scenariu: 'normal',
    sursaDate: 'simulare',
    stareConexiune: 'conectata',
    disponibilitateFluxVideo: 'disponibil',
    stareSecuritate: 'normala',
    ultimaActualizare: '2026-10-31T09:42:00+02:00',
    luminozitate: 74,
    claritate: 91,
    diferentaIntreCadre: 3.6,
    detectieAnomalii: {
      disponibil: true,
      esteAnomalie: false,
      scor: 0.08,
      prag: 0.65,
      descriere: 'Fluxul video este stabil; nu au fost detectate anomalii vizuale.',
    },
    alerte: [],
  },

  avertizare: {
    identificator: IDENTIFICATOR_CAMERA_DEMONSTRATIVA,
    denumire: DENUMIRE_CAMERA_DEMONSTRATIVA,
    scenariu: 'avertizare',
    sursaDate: 'simulare',
    stareConexiune: 'conectata',
    disponibilitateFluxVideo: 'disponibil',
    stareSecuritate: 'avertizare',
    ultimaActualizare: '2026-10-31T09:38:00+02:00',
    luminozitate: 12,
    claritate: 28,
    diferentaIntreCadre: 1.4,
    detectieAnomalii: {
      disponibil: true,
      esteAnomalie: true,
      scor: 0.87,
      prag: 0.65,
      descriere:
        'Anomalie vizuală detectată. Posibilă obturare a obiectivului camerei; este necesară verificarea operatorului.',
    },
    alerte: [
      {
        identificator: 'ALR-CAM-01-001',
        cameraAsociata: IDENTIFICATOR_CAMERA_DEMONSTRATIVA,
        tip: 'anomalie-vizuala',
        severitate: 'avertizare',
        mesaj:
          'Anomalie vizuală detectată pe fluxul camerei. Este necesară verificarea manuală a imaginii.',
        dataOra: '2026-10-31T09:37:00+02:00',
        sursa: 'ml',
      },
      {
        identificator: 'ALR-CAM-01-002',
        cameraAsociata: IDENTIFICATOR_CAMERA_DEMONSTRATIVA,
        tip: 'obturare-posibila',
        severitate: 'avertizare',
        mesaj:
          'Luminozitate și claritate reduse sub pragul configurat. Posibilă obturare a obiectivului; nu este confirmat un atac cibernetic.',
        dataOra: '2026-10-31T09:38:00+02:00',
        sursa: 'regula',
      },
    ],
  },

  offline: {
    identificator: IDENTIFICATOR_CAMERA_DEMONSTRATIVA,
    denumire: DENUMIRE_CAMERA_DEMONSTRATIVA,
    scenariu: 'offline',
    sursaDate: 'simulare',
    stareConexiune: 'deconectata',
    disponibilitateFluxVideo: 'intrerupt',
    stareSecuritate: 'necunoscuta',
    ultimaActualizare: '2026-10-31T09:15:00+02:00',
    luminozitate: null,
    claritate: null,
    diferentaIntreCadre: null,
    detectieAnomalii: {
      disponibil: false,
      esteAnomalie: false,
      scor: null,
      prag: 0.65,
      descriere:
        'Detecția de anomalii nu poate fi evaluată fără flux video. Nu se atribuie un scor artificial.',
    },
    alerte: [
      {
        identificator: 'ALR-CAM-01-003',
        cameraAsociata: IDENTIFICATOR_CAMERA_DEMONSTRATIVA,
        tip: 'intrerupere-flux',
        severitate: 'critica',
        mesaj:
          'Fluxul video al camerei este indisponibil. Cauza nu este cunoscută; este necesară verificarea conexiunii și a echipamentului.',
        dataOra: '2026-10-31T09:16:00+02:00',
        sursa: 'regula',
      },
      {
        identificator: 'ALR-CAM-01-004',
        cameraAsociata: IDENTIFICATOR_CAMERA_DEMONSTRATIVA,
        tip: 'informare-demonstrativa',
        severitate: 'informativa',
        mesaj:
          'Scenariu demonstrativ activ: camera este oprită intenționat, iar valorile afișate sunt fictive.',
        dataOra: '2026-10-31T09:16:00+02:00',
        sursa: 'demonstratie',
      },
    ],
  },
}
