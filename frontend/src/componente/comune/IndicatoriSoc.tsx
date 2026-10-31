import type { DateSoc } from '../../carlige/useDateSoc'
import { formateazaNumarIntreg, formateazaOra } from '../../servicii/formatare'

type Indicator = {
  eticheta: string
  valoare: string
  accent?: boolean
}

/** Rând compact de indicatori principali ai SOC. */
export function IndicatoriSoc({ soc }: { soc: DateSoc }) {
  const prezentare = soc.prezentare
  const ingestie = soc.sanatate?.ingestion

  const indicatori: Indicator[] = [
    { eticheta: 'Evenimente ingerate', valoare: formateazaNumarIntreg(prezentare?.events_total) },
    {
      eticheta: 'Alerte deschise',
      valoare: formateazaNumarIntreg(prezentare?.alerts_open),
      accent: (prezentare?.alerts_open ?? 0) > 0,
    },
    {
      eticheta: 'Incidente deschise',
      valoare: formateazaNumarIntreg(prezentare?.incidents_open),
      accent: (prezentare?.incidents_open ?? 0) > 0,
    },
    {
      eticheta: 'Dispozitive la risc',
      valoare: prezentare
        ? `${formateazaNumarIntreg(prezentare.devices.at_risk)} / ${formateazaNumarIntreg(prezentare.devices.total)}`
        : '0 / 0',
      accent: (prezentare?.devices.at_risk ?? 0) > 0,
    },
  ]

  return (
    <div className="indicatori-soc">
      <ul className="indicatori-soc__lista" aria-label="Indicatori SOC">
        {indicatori.map((indicator) => (
          <li
            key={indicator.eticheta}
            className={`indicator-soc${indicator.accent ? ' indicator-soc--accent' : ''}`}
          >
            <span className="indicator-soc__eticheta">{indicator.eticheta}</span>
            <span className="indicator-soc__valoare">{indicator.valoare}</span>
          </li>
        ))}
      </ul>
      <p className="indicatori-soc__stare">
        {ingestie ? (
          <>
            Ingestie:{' '}
            <strong>{ingestie.connected ? 'simulator conectat' : 'simulator indisponibil'}</strong>
            {ingestie.run_id && <> · rulare {ingestie.run_id} · seq {ingestie.last_seq}</>}
            {ingestie.error && <> · {ingestie.error}</>}
            {soc.sanatate?.model && (
              <> · model ML {soc.sanatate.model.loaded ? `încărcat (${soc.sanatate.model.version ?? 'n/a'})` : 'neîncărcat'}</>
            )}
            {' '}· actualizat {formateazaOra(soc.ultimaActualizare)}
          </>
        ) : (
          'Starea ingestiei nu este disponibilă.'
        )}
      </p>
    </div>
  )
}
