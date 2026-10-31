import type { DateSoc } from '../../carlige/useDateSoc'
import { formateazaNumarIntreg } from '../../servicii/formatare'

type Indicator = {
  eticheta: string
  valoare: string
  accent?: boolean
}

/** Rând compact de indicatori principali ai SOC. */
export function IndicatoriSoc({ soc }: { soc: DateSoc }) {
  const prezentare = soc.prezentare

  const indicatori: Indicator[] = [
    { eticheta: 'Evenimente', valoare: formateazaNumarIntreg(prezentare?.events_total) },
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
    </div>
  )
}
