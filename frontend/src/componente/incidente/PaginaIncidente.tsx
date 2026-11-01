import { RestabilesteDispozitiv } from '../comune/RestabilesteDispozitiv'
import { useEffect, useState } from 'react'
import type { DateSoc } from '../../carlige/useDateSoc'
import {
  actualizeazaStareIncident,
  izoleazaDispozitiv,
  obtineDetaliiIncident,
} from '../../servicii/clientSoc'
import {
  ORDINE_STARI_INCIDENT,
  SEVERITATI_SOC,
  STARI_INCIDENT,
  STARI_OPERATIONALE,
  formateazaDataOra,
  formateazaOra,
  stareSau,
} from '../../servicii/formatare'
import type { DetaliiIncidentSoc, IncidentSoc, StareIncident } from '../../tipuri/soc'
import {
  Card,
  Insigna,
  MesajSocIndisponibil,
  StareGoala,
} from '../comune/ElementeSoc'

function ListaIncidente({
  incidente,
  idSelectat,
  onSelecteaza,
}: {
  incidente: IncidentSoc[]
  idSelectat: string | null
  onSelecteaza: (id: string) => void
}) {
  if (incidente.length === 0) {
    return (
      <StareGoala mesaj="Nu există incidente. Porniți un scenariu din panoul simulatorului pentru a genera activitate." />
    )
  }

  return (
    <div className="tabel-container">
      <table className="tabel">
        <thead>
          <tr>
            <th scope="col">Incident</th>
            <th scope="col">Severitate</th>
            <th scope="col">Stare</th>
            <th scope="col">Dispozitive</th>
            <th scope="col">Tactici</th>
            <th scope="col">Alerte deschise / total</th>
            <th scope="col">Actualizat</th>
          </tr>
        </thead>
        <tbody>
          {incidente.map((incident) => (
            <tr
              key={incident.incident_id}
              className={incident.incident_id === idSelectat ? 'tabel__rand--selectat' : undefined}
            >
              <td>
                <button
                  type="button"
                  className="tabel__legatura"
                  aria-pressed={incident.incident_id === idSelectat}
                  onClick={() => onSelecteaza(incident.incident_id)}
                >
                  {incident.title}
                </button>
                <span className="tabel__secundar">{incident.incident_id}</span>
              </td>
              <td>
                <Insigna stare={stareSau(SEVERITATI_SOC, incident.severity)} />
              </td>
              <td>
                <Insigna stare={stareSau(STARI_INCIDENT, incident.status)} />
              </td>
              <td>{incident.devices.join(', ') || '—'}</td>
              <td>{incident.tactics.join(', ') || '—'}</td>
              <td>{incident.open_alert_count ?? incident.alert_count} / {incident.alert_count}</td>
              <td>{formateazaDataOra(incident.updated_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function DetaliiIncident({
  detalii,
  soc,
  onModificat,
}: {
  detalii: DetaliiIncidentSoc
  soc: DateSoc
  onModificat: () => void
}) {
  const [inLucru, setInLucru] = useState<string | null>(null)
  const [mesaj, setMesaj] = useState<string | null>(null)

  const executa = async (cheie: string, actiune: () => Promise<unknown>, succes: string) => {
    setInLucru(cheie)
    setMesaj(null)
    try {
      await actiune()
      setMesaj(succes)
      onModificat()
    } catch (eroare) {
      setMesaj(eroare instanceof Error ? eroare.message : 'Acțiunea a eșuat.')
    } finally {
      setInLucru(null)
    }
  }

  const schimbaStare = (stare: StareIncident) =>
    executa(
      `stare-${stare}`,
      () => actualizeazaStareIncident(detalii.incident_id, stare),
      `Starea incidentului a fost schimbată în „${STARI_INCIDENT[stare].eticheta}”.`,
    )

  const izoleaza = (idDispozitiv: string) =>
    executa(
      `izolare-${idDispozitiv}`,
      () => izoleazaDispozitiv(detalii.incident_id, idDispozitiv),
      `Cererea de izolare pentru ${idDispozitiv} a fost trimisă.`,
    )

  return (
    <Card
      titlu={detalii.title}
      actiuni={<Insigna stare={stareSau(SEVERITATI_SOC, detalii.severity)} />}
    >
      <p className="detalii-incident__rezumat">{detalii.summary}</p>
      <p className="tabel__secundar">
        {detalii.incident_id} · creat {formateazaDataOra(detalii.created_at)} · actualizat{' '}
        {formateazaDataOra(detalii.updated_at)}
      </p>

      <div className="detalii-incident__sectiune">
        <h3 className="detalii-incident__titlu">Stare incident</h3>
        <div className="grup-butoane" role="group" aria-label="Schimbă starea incidentului">
          {ORDINE_STARI_INCIDENT.map((stare) => (
            <button
              key={stare}
              type="button"
              className={`buton-scenariu${detalii.status === stare ? ' buton-scenariu--activ' : ''}`}
              aria-pressed={detalii.status === stare}
              disabled={inLucru !== null || detalii.status === stare}
              onClick={() => void schimbaStare(stare)}
            >
              {STARI_INCIDENT[stare].eticheta}
            </button>
          ))}
        </div>
      </div>

      <div className="detalii-incident__sectiune">
        <h3 className="detalii-incident__titlu">Dispozitive implicate</h3>
        <ul className="lista-dispozitive">
          {detalii.devices.map((idDispozitiv) => {
            const dispozitiv = soc.dispozitive.find((d) => d.device_id === idDispozitiv)
            const izolat = dispozitiv?.operational_status === 'isolated'
            return (
              <li key={idDispozitiv} className="lista-dispozitive__element">
                <span className="lista-dispozitive__nume">
                  <strong>{idDispozitiv}</strong>
                  {dispozitiv && <span className="tabel__secundar">{dispozitiv.name}</span>}
                </span>
                {dispozitiv && (
                  <Insigna stare={stareSau(STARI_OPERATIONALE, dispozitiv.operational_status)} />
                )}
                <button
                  type="button"
                  className="buton-actiune"
                  disabled={inLucru !== null || izolat}
                  onClick={() => void izoleaza(idDispozitiv)}
                >
                  {izolat ? 'Izolat' : 'Izolează dispozitiv'}
                </button>
                <RestabilesteDispozitiv id={idDispozitiv} onRestabilit={onModificat} />
              </li>
            )
          })}
        </ul>
      </div>

      {mesaj && (
        <p className="detalii-incident__mesaj" role="status">
          {mesaj}
        </p>
      )}

      <div className="detalii-incident__sectiune">
        <h3 className="detalii-incident__titlu">Alerte ({detalii.alerts.length})</h3>
        {detalii.alerts.length === 0 ? (
          <StareGoala mesaj="Nicio alertă asociată." />
        ) : (
          <ul className="lista-alerte">
            {detalii.alerts.map((alerta) => (
              <li key={alerta.alert_id} className="lista-alerte__element">
                <div className="lista-alerte__antet">
                  <Insigna stare={stareSau(SEVERITATI_SOC, alerta.severity)} />
                  <strong>{alerta.title}</strong>
                  <span className="tabel__secundar">
                    {alerta.source === 'ml' ? 'ML' : `Regulă ${alerta.rule_id}`} · {alerta.device_id}{' '}
                    · {formateazaOra(alerta.created_at)} · {alerta.status === 'closed' ? 'Închisă' : 'Deschisă'}
                  </span>
                </div>
                <p className="lista-alerte__descriere">{alerta.description}</p>
                {alerta.mitre && (
                  <p className="lista-alerte__mitre">
                    MITRE ATT&amp;CK: <strong>{alerta.mitre.technique_id}</strong>{' '}
                    {alerta.mitre.technique} · {alerta.mitre.tactic}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="detalii-incident__sectiune">
        <h3 className="detalii-incident__titlu">
          Cronologie evenimente ({detalii.timeline.length})
        </h3>
        {detalii.timeline.length === 0 ? (
          <StareGoala mesaj="Nu există evenimente asociate." />
        ) : (
          <div className="tabel-container tabel-container--limitat">
            <table className="tabel tabel--compact">
              <thead>
                <tr>
                  <th scope="col">Ora</th>
                  <th scope="col">Dispozitiv</th>
                  <th scope="col">Eveniment</th>
                  <th scope="col">Rezultat</th>
                  <th scope="col">Sursă</th>
                </tr>
              </thead>
              <tbody>
                {detalii.timeline.map((eveniment) => (
                  <tr key={eveniment.event_id}>
                    <td>{formateazaOra(eveniment.occurred_at)}</td>
                    <td>{eveniment.device_id}</td>
                    <td>{eveniment.event_type}</td>
                    <td>{eveniment.outcome}</td>
                    <td>
                      {eveniment.source.ip}
                      {eveniment.source.user && ` (${eveniment.source.user})`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {detalii.actions.length > 0 && (
        <div className="detalii-incident__sectiune">
          <h3 className="detalii-incident__titlu">Acțiuni de răspuns</h3>
          <ul className="lista-simpla">
            {detalii.actions.map((actiune, index) => (
              <li key={`${actiune.action}-${index}`}>
                {formateazaDataOra(actiune.performed_at)} · {actiune.action}
                {actiune.device_id && ` · ${actiune.device_id}`}
                {actiune.result && ` · ${actiune.result}`}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  )
}

export function PaginaIncidente({ soc }: { soc: DateSoc }) {
  const [idSelectat, setIdSelectat] = useState<string | null>(null)
  const [detalii, setDetalii] = useState<DetaliiIncidentSoc | null>(null)
  const [eroareDetalii, setEroareDetalii] = useState<string | null>(null)
  const [versiune, setVersiune] = useState(0)

  const { conectat, ultimaActualizare, reimprospateaza } = soc

  useEffect(() => {
    if (!idSelectat || !conectat) {
      return
    }
    let anulat = false
    obtineDetaliiIncident(idSelectat)
      .then((rezultat) => {
        if (!anulat) {
          setDetalii(rezultat)
          setEroareDetalii(null)
        }
      })
      .catch((eroare: unknown) => {
        if (!anulat) {
          setEroareDetalii(eroare instanceof Error ? eroare.message : 'Eroare la încărcare.')
        }
      })
    return () => {
      anulat = true
    }
  }, [idSelectat, conectat, ultimaActualizare, versiune])

  const detaliiAfisate = detalii && detalii.incident_id === idSelectat ? detalii : null

  let continutDetalii
  if (idSelectat === null) {
    continutDetalii = (
      <Card>
        <StareGoala mesaj="Selectați un incident pentru a vedea alertele, cronologia și acțiunile de răspuns." />
      </Card>
    )
  } else if (detaliiAfisate) {
    continutDetalii = (
      <DetaliiIncident
        detalii={detaliiAfisate}
        soc={soc}
        onModificat={() => {
          setVersiune((valoare) => valoare + 1)
          reimprospateaza()
        }}
      />
    )
  } else {
    continutDetalii = (
      <Card>
        <StareGoala mesaj={eroareDetalii ?? 'Se încarcă detaliile incidentului...'} />
      </Card>
    )
  }

  return (
    <section className="pagina" aria-labelledby="titlu-incidente">

      {!conectat && !soc.seIncarca ? (
        <MesajSocIndisponibil eroare={soc.eroare} />
      ) : (
        <div className="aranjament-detalii">
          <Card titlu={`Incidente (${soc.incidente.length})`}>
            <ListaIncidente
              incidente={soc.incidente}
              idSelectat={idSelectat}
              onSelecteaza={setIdSelectat}
            />
          </Card>
          {continutDetalii}
        </div>
      )}
    </section>
  )
}
