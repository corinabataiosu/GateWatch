import { useState } from 'react'
import { EroareSoc, adresaRaportHtml, genereazaRaport } from '../../servicii/clientSoc'
import {
  SEVERITATI_SOC,
  STARI_INCIDENT,
  formateazaDataOra,
  formateazaNumarIntreg,
} from '../../servicii/formatare'
import type { RaportSoc } from '../../tipuri/soc'
import { Card, Insigna, StareGoala } from '../comune/ElementeSoc'

type StareGenerare =
  | { tip: 'inactiv' }
  | { tip: 'se-genereaza' }
  | { tip: 'gata'; raport: RaportSoc }
  | { tip: 'eroare'; mesaj: string }

/**
 * Generează raportul de activitate al SOC și îl afișează.
 * Raportul este calculat de backend din alertele și incidentele detectate; aceeași
 * versiune poate fi descărcată ca document HTML tipăribil.
 */
export function RaportGenerat({ conectat }: { conectat: boolean }) {
  const [stare, setStare] = useState<StareGenerare>({ tip: 'inactiv' })

  const genereaza = async () => {
    setStare({ tip: 'se-genereaza' })
    try {
      setStare({ tip: 'gata', raport: await genereazaRaport() })
    } catch (eroare) {
      setStare({
        tip: 'eroare',
        mesaj: eroare instanceof EroareSoc ? eroare.message : 'Raportul nu a putut fi generat.',
      })
    }
  }

  return (
    <Card titlu="Raport de activitate">
      <div className="bara-actiuni">
        <button
          type="button"
          className="buton-actiune"
          onClick={genereaza}
          disabled={!conectat || stare.tip === 'se-genereaza'}
        >
          {stare.tip === 'se-genereaza' ? 'Se generează...' : 'Generează raport'}
        </button>
        {stare.tip === 'gata' && (
          <a className="buton-actiune buton-actiune--secundar" href={adresaRaportHtml()} download>
            Descarcă raport (HTML)
          </a>
        )}
        {stare.tip === 'gata' && (
          <span className="tabel__secundar">
            Generat la {formateazaDataOra(stare.raport.generated_at)}
          </span>
        )}
      </div>

      {stare.tip === 'eroare' && (
        <p className="raport__eroare" role="alert">
          {stare.mesaj}
        </p>
      )}
      {stare.tip === 'gata' && <ContinutRaport raport={stare.raport} />}
    </Card>
  )
}

function ContinutRaport({ raport }: { raport: RaportSoc }) {
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

    </div>
  )
}
