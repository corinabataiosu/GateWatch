/**
 * Tipuri pentru camera demonstrativă GateWatch.
 * Toate valorile numerice asociate acestor tipuri sunt fictive și nu reprezintă măsurători reale.
 */

/** Identificatorul unic al unei camere, de forma CAM-01. */
export type IdentificatorCamera = `CAM-${string}`

/** Denumirea afișată a camerei. */
export type DenumireCamera = string

/** Starea conexiunii camerei la sistemul de supraveghere. */
export type StareConexiune = 'conectata' | 'instabila' | 'deconectata'

/** Disponibilitatea fluxului video, independentă de rezultatul detectării de anomalii. */
export type DisponibilitateFluxVideo = 'disponibil' | 'degradat' | 'intrerupt'

/**
 * Starea de securitate a camerei. „compromisa” este stabilită doar de SOC, pe baza detecțiilor;
 * interfața nu deduce un atac din lipsa fluxului video.
 */
export type StareSecuritate = 'normala' | 'avertizare' | 'compromisa' | 'necunoscuta'

/** Momentul ultimei actualizări, în format ISO 8601. */
export type DataOraISO = string

/** Scenariile demonstrative disponibile pentru cameră. */
export type ScenariuCamera = 'normal' | 'avertizare' | 'offline'

/**
 * Marchează explicit proveniența datelor: scenarii locale de simulare
 * sau starea calculată de backend-ul SOC.
 */
export type SursaDateCamera = 'simulare' | 'soc'

/** Identificatorul unic al unei alerte, de forma ALR-CAM-01-001. */
export type IdentificatorAlerta = `ALR-${string}`

/** Tipurile de alerte care pot fi asociate camerei. */
export type TipAlertaCamera =
  | 'anomalie-vizuala'
  | 'obturare-posibila'
  | 'intrerupere-flux'
  | 'informare-demonstrativa'
  | 'detectie-soc'

/** Severitatea unei alerte. */
export type SeveritateAlerta = 'informativa' | 'avertizare' | 'critica'

/** Sursa care a generat alerta. */
export type SursaAlerta = 'regula' | 'ml' | 'demonstratie'

/** O alertă asociată unei camere. */
export type AlertaCamera = {
  identificator: IdentificatorAlerta
  cameraAsociata: IdentificatorCamera
  tip: TipAlertaCamera
  severitate: SeveritateAlerta
  mesaj: string
  dataOra: DataOraISO
  sursa: SursaAlerta
}

/**
 * Rezultatul detectării de anomalii vizuale.
 * Când fluxul video nu este disponibil, scorul este null și rezultatul nu este evaluat.
 */
export type RezultatDetectieAnomalii = {
  disponibil: boolean
  esteAnomalie: boolean
  scor: number | null
  prag: number
  descriere: string
}

/**
 * Starea completă a camerei demonstrative.
 * Luminozitatea, claritatea și diferența dintre cadre sunt exprimate pe o scală 0-100.
 */
export type CameraDemonstrativa = {
  identificator: IdentificatorCamera
  denumire: DenumireCamera
  scenariu: ScenariuCamera
  sursaDate: SursaDateCamera
  stareConexiune: StareConexiune
  disponibilitateFluxVideo: DisponibilitateFluxVideo
  stareSecuritate: StareSecuritate
  ultimaActualizare: DataOraISO
  luminozitate: number | null
  claritate: number | null
  diferentaIntreCadre: number | null
  detectieAnomalii: RezultatDetectieAnomalii
  alerte: AlertaCamera[]
}
