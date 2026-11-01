import {
  SEVERITATI_SOC,
  STARI_INCIDENT,
  STARI_SECURITATE_SOC,
  formateazaDataOra,
  formateazaNumarIntreg,
} from '../../servicii/formatare'
import type { RaportSoc } from '../../tipuri/soc'
import { Insigna, StareGoala } from '../comune/ElementeSoc'

/** Conținutul raportului de activitate calculat de SOC (GET /api/report). */
export function RaportGenerat({ raport }: { raport: RaportSoc }) {
  const total = raport.totals

  return (
    <div className="raport" aria-live="polite">
      <p className="raport__rezumat">{raport.summary}</p>

      <dl className="raport__totaluri">
        <div>
          <dt>Evenimente analizate</dt>
          <dd>{formateazaNumarIntreg(total.events)}</dd>
        </div>
        <div>
          <dt>Alerte (deschise)</dt>
          <dd>
            {formateazaNumarIntreg(total.alerts)} ({formateazaNumarIntreg(total.alerts_open)})
          </dd>
        </div>
        <div>
          <dt>Incidente (deschise)</dt>
          <dd>
            {formateazaNumarIntreg(total.incidents)} ({formateazaNumarIntreg(total.incidents_open)})
          </dd>
        </div>
        <div>
          <dt>Dispozitive la risc</dt>
          <dd>{formateazaNumarIntreg(total.devices_at_risk)}</dd>
        </div>
      </dl>
      <p className="raport__nota">
        Perioadă: {formateazaDataOra(raport.period.first_event)} –{' '}
        {formateazaDataOra(raport.period.last_event)} · surse: {total.alerts_rule} alerte din
        reguli, {total.alerts_ml} din modele ML
      </p>

      <h3 className="raport__titlu">Incidente</h3>
      {raport.incidents.length === 0 ? (
        <StareGoala mesaj="Nu au fost corelate incidente." />
      ) : (
        <ul className="raport__incidente">
          {raport.incidents.map((incident) => (
            <li key={incident.incident_id} className="raport__incident">
              <div className="raport__incident-antet">
                <strong>
                  {incident.incident_id} — {incident.title}
                </strong>
                <Insigna stare={SEVERITATI_SOC[incident.severity]} />
                <Insigna stare={STARI_INCIDENT[incident.status]} />
              </div>
              <p className="raport__nota">{incident.summary}</p>
              <ul className="raport__alerte">
                {incident.alerts.map((alerta) => (
                  <li key={alerta.alert_id}>
                    <span className="tabel__monospatiat">{alerta.rule_id}</span> {alerta.title}
                    {alerta.technique_id && (
                      <span className="raport__tehnica"> · {alerta.technique_id}</span>
                    )}
                    <span className="raport__detaliu">{alerta.description}</span>
                  </li>
                ))}
              </ul>
              {incident.actions.length > 0 && (
                <p className="raport__nota">
                  Acțiuni de răspuns: {incident.actions.length} (ultima:{' '}
                  {incident.actions[incident.actions.length - 1].detail ??
                    incident.actions[incident.actions.length - 1].action}
                  )
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      <h3 className="raport__titlu">Dispozitive la risc</h3>
      {raport.devices_at_risk.length === 0 ? (
        <StareGoala mesaj="Niciun dispozitiv la risc." />
      ) : (
        <table className="tabel tabel--compact">
          <tbody>
            {raport.devices_at_risk.map((dispozitiv) => (
              <tr key={dispozitiv.device_id}>
                <td className="tabel__monospatiat">{dispozitiv.device_id}</td>
                <td>{dispozitiv.name}</td>
                <td>
                  <Insigna stare={STARI_SECURITATE_SOC[dispozitiv.security_state]} />
                </td>
                <td className="tabel__numar">
                  {formateazaNumarIntreg(dispozitiv.open_alerts)} alerte deschise
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
