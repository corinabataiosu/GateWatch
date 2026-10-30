import { useCameraDemonstrativa } from '../../carlige/useCameraDemonstrativa'
import type {
  CameraDemonstrativa,
  DisponibilitateFluxVideo,
  ScenariuCamera,
  SeveritateAlerta,
  StareConexiune,
  StareSecuritate,
  SursaAlerta,
  TipAlertaCamera,
} from '../../tipuri/camera'

type ClasaStare = 'buna' | 'atentie' | 'alerta' | 'neutra'

type StareAfisata = {
  eticheta: string
  clasa: ClasaStare
}

const STARI_CONEXIUNE: Record<StareConexiune, StareAfisata> = {
  conectata: { eticheta: 'Conectată', clasa: 'buna' },
  instabila: { eticheta: 'Instabilă', clasa: 'atentie' },
  deconectata: { eticheta: 'Deconectată', clasa: 'alerta' },
}

const STARI_FLUX: Record<DisponibilitateFluxVideo, StareAfisata> = {
  disponibil: { eticheta: 'Disponibil', clasa: 'buna' },
  degradat: { eticheta: 'Degradat', clasa: 'atentie' },
  intrerupt: { eticheta: 'Întrerupt', clasa: 'alerta' },
}

const STARI_SECURITATE: Record<StareSecuritate, StareAfisata> = {
  normala: { eticheta: 'Normală', clasa: 'buna' },
  avertizare: { eticheta: 'Avertizare', clasa: 'atentie' },
  necunoscuta: { eticheta: 'Necunoscută', clasa: 'neutra' },
}

const STARI_SCENARIU: Record<ScenariuCamera, StareAfisata> = {
  normal: { eticheta: 'Funcționare normală', clasa: 'buna' },
  avertizare: { eticheta: 'Anomalie simulată', clasa: 'atentie' },
  offline: { eticheta: 'Deconectare simulată', clasa: 'alerta' },
}

const STARI_SEVERITATE: Record<SeveritateAlerta, StareAfisata> = {
  informativa: { eticheta: 'Informativă', clasa: 'neutra' },
  avertizare: { eticheta: 'Avertizare', clasa: 'atentie' },
  critica: { eticheta: 'Critică', clasa: 'alerta' },
}

const ETICHETE_TIP_ALERTA: Record<TipAlertaCamera, string> = {
  'anomalie-vizuala': 'Anomalie vizuală',
  'obturare-posibila': 'Obturare posibilă',
  'intrerupere-flux': 'Întrerupere flux',
  'informare-demonstrativa': 'Informare demonstrativă',
}

const ETICHETE_SURSA: Record<SursaAlerta, string> = {
  regula: 'Regulă',
  ml: 'ML',
  demonstratie: 'Demonstrație',
}

const FORMATATOR_DATA = new Intl.DateTimeFormat('ro-RO', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Europe/Bucharest',
})

function formateazaDataOra(valoare: string): string {
  return FORMATATOR_DATA.format(new Date(valoare))
}

function formateazaNumar(
  valoare: number,
  zecimale: number,
): string {
  return valoare.toLocaleString('ro-RO', {
    minimumFractionDigits: zecimale,
    maximumFractionDigits: zecimale,
  })
}

function formateazaMetrica(valoare: number | null, zecimale: number): string {
  if (valoare === null) {
    return 'Indisponibil'
  }

  return `${formateazaNumar(valoare, zecimale)} / 100`
}

function formateazaScor(valoare: number | null): string {
  if (valoare === null) {
    return 'indisponibil'
  }

  return formateazaNumar(valoare, 2)
}

function obtineAnalizaMl(camera: CameraDemonstrativa): StareAfisata & {
  detaliu: string
} {
  const detectie = camera.detectieAnomalii

  if (!detectie.disponibil) {
    return {
      eticheta: 'Indisponibilă',
      clasa: 'neutra',
      detaliu: 'Fără flux video; scorul nu este calculat.',
    }
  }

  if (detectie.esteAnomalie) {
    return {
      eticheta: 'Anomalie detectată',
      clasa: 'alerta',
      detaliu: `Scor ${formateazaScor(detectie.scor)} · prag ${formateazaScor(detectie.prag)}`,
    }
  }

  return {
    eticheta: 'Fără anomalii',
    clasa: 'buna',
    detaliu: `Scor ${formateazaScor(detectie.scor)} · prag ${formateazaScor(detectie.prag)}`,
  }
}

function clasaMetrica(valoare: number | null): string {
  return valoare === null ? ' metrici-camera__valoare--indisponibil' : ''
}

export function PanouStareCamera() {
  const {
    scenariu,
    camera,
    seteazaScenariu,
    revinoLaNormal,
  } = useCameraDemonstrativa()

  const stareConexiune = STARI_CONEXIUNE[camera.stareConexiune]
  const stareFlux = STARI_FLUX[camera.disponibilitateFluxVideo]
  const stareSecuritate = STARI_SECURITATE[camera.stareSecuritate]
  const stareScenariu = STARI_SCENARIU[scenariu]
  const analizaMl = obtineAnalizaMl(camera)
  const numarAlerte = camera.alerte.length

  return (
    <section
      className="panou-stare-camera"
      aria-labelledby="titlu-panou-stare-camera"
    >
      <header className="panou-stare-camera__antet">
        <div className="panou-stare-camera__identitate">
          <p className="panou-stare-camera__eticheta">Stare cameră</p>
          <h2
            id="titlu-panou-stare-camera"
            className="panou-stare-camera__titlu"
          >
            {camera.denumire}
          </h2>
          <p className="panou-stare-camera__meta">
            Identificator {camera.identificator} · Ultima actualizare{' '}
            {formateazaDataOra(camera.ultimaActualizare)}
          </p>
        </div>

        <div className="panou-stare-camera__insigne">
          <span className="insigna-demonstrativa">Date simulate</span>
          <span
            className={`insigna-scenariu insigna-scenariu--${stareScenariu.clasa}`}
          >
            {stareScenariu.eticheta}
          </span>
        </div>
      </header>

      <p className="panou-stare-camera__anunt" role="status">
        Scenariu activ: {stareScenariu.eticheta}.{' '}
        {numarAlerte === 0
          ? 'Nu există alerte active.'
          : `${numarAlerte} ${numarAlerte === 1 ? 'alertă activă' : 'alerte active'}.`}
      </p>

      <div className="panou-stare-camera__grila">
        <div className="indicator-camera">
          <span className="indicator-camera__eticheta">Conexiune</span>
          <span
            className={`indicator-camera__valoare indicator-camera__valoare--${stareConexiune.clasa}`}
          >
            {stareConexiune.eticheta}
          </span>
        </div>

        <div className="indicator-camera">
          <span className="indicator-camera__eticheta">Flux video</span>
          <span
            className={`indicator-camera__valoare indicator-camera__valoare--${stareFlux.clasa}`}
          >
            {stareFlux.eticheta}
          </span>
        </div>

        <div className="indicator-camera">
          <span className="indicator-camera__eticheta">Analiză ML</span>
          <span
            className={`indicator-camera__valoare indicator-camera__valoare--${analizaMl.clasa}`}
          >
            {analizaMl.eticheta}
          </span>
          <span className="indicator-camera__detaliu">{analizaMl.detaliu}</span>
        </div>

        <div className="indicator-camera">
          <span className="indicator-camera__eticheta">Stare securitate</span>
          <span
            className={`indicator-camera__valoare indicator-camera__valoare--${stareSecuritate.clasa}`}
          >
            {stareSecuritate.eticheta}
          </span>
        </div>
      </div>

      <p className="panou-stare-camera__detaliu-analiza">
        <span>Rezultat analiză:</span> {camera.detectieAnomalii.descriere}
      </p>

      <section
        className="panou-stare-camera__sectiune"
        aria-labelledby="titlu-metrici-camera"
      >
        <h3
          id="titlu-metrici-camera"
          className="panou-stare-camera__titlu-sectiune"
        >
          Metrici vizuale
        </h3>

        <dl className="metrici-camera" aria-label="Metrici vizuale simulate">
          <div className="metrici-camera__element">
            <dt className="metrici-camera__eticheta">Luminozitate</dt>
            <dd
              className={`metrici-camera__valoare${clasaMetrica(camera.luminozitate)}`}
            >
              {formateazaMetrica(camera.luminozitate, 0)}
            </dd>
          </div>

          <div className="metrici-camera__element">
            <dt className="metrici-camera__eticheta">Claritate</dt>
            <dd
              className={`metrici-camera__valoare${clasaMetrica(camera.claritate)}`}
            >
              {formateazaMetrica(camera.claritate, 0)}
            </dd>
          </div>

          <div className="metrici-camera__element">
            <dt className="metrici-camera__eticheta">Diferență între cadre</dt>
            <dd
              className={`metrici-camera__valoare${clasaMetrica(camera.diferentaIntreCadre)}`}
            >
              {formateazaMetrica(camera.diferentaIntreCadre, 1)}
            </dd>
          </div>
        </dl>
      </section>

      <fieldset className="panou-stare-camera__controale">
        <legend className="panou-stare-camera__legenda">
          Scenarii simulate
        </legend>
        <div className="panou-stare-camera__butoane">
          <button
            type="button"
            className={`buton-scenariu${scenariu === 'normal' ? ' buton-scenariu--activ' : ''}`}
            aria-pressed={scenariu === 'normal'}
            onClick={revinoLaNormal}
          >
            Funcționare normală
          </button>
          <button
            type="button"
            className={`buton-scenariu${scenariu === 'avertizare' ? ' buton-scenariu--activ' : ''}`}
            aria-pressed={scenariu === 'avertizare'}
            onClick={() => seteazaScenariu('avertizare')}
          >
            Simulează anomalie
          </button>
          <button
            type="button"
            className={`buton-scenariu${scenariu === 'offline' ? ' buton-scenariu--activ' : ''}`}
            aria-pressed={scenariu === 'offline'}
            onClick={() => seteazaScenariu('offline')}
          >
            Simulează deconectare
          </button>
        </div>
      </fieldset>

      <section
        className="panou-stare-camera__sectiune"
        aria-labelledby="titlu-alerte-camera"
      >
        <h3
          id="titlu-alerte-camera"
          className="panou-stare-camera__titlu-sectiune"
        >
          Alerte active
          <span className="panou-stare-camera__numar-alerte">
            {numarAlerte}
          </span>
        </h3>

        {numarAlerte === 0 ? (
          <p className="panou-stare-camera__fara-alerte">
            Nu există alerte active pentru această cameră.
          </p>
        ) : (
          <ul className="alerte-camera">
            {camera.alerte.map((alerta) => {
              const severitate = STARI_SEVERITATE[alerta.severitate]

              return (
                <li
                  className={`alerta-camera alerta-camera--${severitate.clasa}`}
                  key={alerta.identificator}
                >
                  <div className="alerta-camera__antet">
                    <span
                      className={`alerta-camera__severitate alerta-camera__severitate--${severitate.clasa}`}
                    >
                      {severitate.eticheta}
                    </span>
                    <span className="alerta-camera__tip">
                      {ETICHETE_TIP_ALERTA[alerta.tip]}
                    </span>
                    <time
                      className="alerta-camera__ora"
                      dateTime={alerta.dataOra}
                    >
                      {formateazaDataOra(alerta.dataOra)}
                    </time>
                  </div>
                  <p className="alerta-camera__mesaj">{alerta.mesaj}</p>
                  <p className="alerta-camera__meta">
                    Sursă: {ETICHETE_SURSA[alerta.sursa]} ·{' '}
                    {alerta.identificator}
                  </p>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <p className="panou-stare-camera__nota">
        Datele afișate sunt simulate exclusiv pentru demonstrație și nu
        reprezintă măsurători reale.
      </p>
    </section>
  )
}
