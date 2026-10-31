import { useEffect, useState } from 'react'
import type { DateSoc } from '../../carlige/useDateSoc'
import { obtineEvenimente } from '../../servicii/clientSoc'
import {
  ETICHETE_TIP_DISPOZITIV,
  ETICHETE_ZONE,
  STARI_OPERATIONALE,
  STARI_SECURITATE_SOC,
  formateazaOra,
  stareSau,
} from '../../servicii/formatare'
import type { DispozitivSoc, EvenimentSoc } from '../../tipuri/soc'
import {
  AntetPagina,
  Card,
  Insigna,
  MesajSocIndisponibil,
  StareGoala,
} from '../comune/ElementeSoc'

const ORDINE_ZONE = ['terminal', 'airside', 'perimeter', 'operations']

const ETICHETE_ORIGINE: Record<EvenimentSoc['origin'], string> = {
  synthetic: 'Trafic de bază',
  scenario_generated: 'Scenariu',
  observed_http: 'Cerere HTTP reală',
}

function grupeazaPeZone(dispozitive: DispozitivSoc[]): [string, DispozitivSoc[]][] {
  const grupuri = new Map<string, DispozitivSoc[]>()
  for (const dispozitiv of dispozitive) {
    const lista = grupuri.get(dispozitiv.zone) ?? []
    lista.push(dispozitiv)
    grupuri.set(dispozitiv.zone, lista)
  }
  return [...grupuri.entries()].sort(
    ([a], [b]) =>
      (ORDINE_ZONE.indexOf(a) + 1 || 99) - (ORDINE_ZONE.indexOf(b) + 1 || 99),
  )
}

export function PaginaRetea({ soc }: { soc: DateSoc }) {
  const [evenimente, setEvenimente] = useState<EvenimentSoc[]>([])
  const [filtruDispozitiv, setFiltruDispozitiv] = useState('')
  const { conectat, ultimaActualizare } = soc

  useEffect(() => {
    if (!conectat) {
      return
    }
    let anulat = false
    obtineEvenimente({ deviceId: filtruDispozitiv || undefined, limita: 100 })
      .then((rezultat) => {
        if (!anulat) {
          setEvenimente(rezultat)
        }
      })
      .catch(() => {
        // Eroarea de conexiune este semnalată deja de indicatorul global SOC.
      })
    return () => {
      anulat = true
    }
  }, [conectat, ultimaActualizare, filtruDispozitiv])

  return (
    <section className="pagina" aria-labelledby="titlu-retea">
      <AntetPagina
        id="titlu-retea"
        eticheta="Secțiune"
        titlu="Rețea"
        subtitlu="Inventarul infrastructurii conectate, pe zone, și fluxul recent de evenimente ingerate de SOC."
      />

      {!conectat && !soc.seIncarca ? (
        <MesajSocIndisponibil eroare={soc.eroare} />
      ) : (
        <>
          {soc.dispozitive.length === 0 ? (
            <Card>
              <StareGoala mesaj="SOC nu a raportat încă niciun dispozitiv." />
            </Card>
          ) : (
            <div className="grila-zone">
              {grupeazaPeZone(soc.dispozitive).map(([zona, dispozitive]) => (
                <Card key={zona} titlu={`${ETICHETE_ZONE[zona] ?? zona} (${dispozitive.length})`}>
                  <ul className="lista-dispozitive">
                    {dispozitive.map((dispozitiv) => (
                      <li key={dispozitiv.device_id} className="lista-dispozitive__element">
                        <span className="lista-dispozitive__nume">
                          <strong>{dispozitiv.device_id}</strong>
                          <span className="tabel__secundar">
                            {ETICHETE_TIP_DISPOZITIV[dispozitiv.type] ?? dispozitiv.type} ·{' '}
                            <span className="tabel__monospatiat">{dispozitiv.ip}</span>
                          </span>
                        </span>
                        <Insigna
                          stare={stareSau(STARI_OPERATIONALE, dispozitiv.operational_status)}
                        />
                        <Insigna
                          stare={stareSau(STARI_SECURITATE_SOC, dispozitiv.security_state)}
                        />
                      </li>
                    ))}
                  </ul>
                </Card>
              ))}
            </div>
          )}

          <Card
            titlu="Evenimente recente"
            actiuni={
              <label className="camp-filtru">
                <span>Dispozitiv</span>
                <select
                  value={filtruDispozitiv}
                  onChange={(eveniment) => setFiltruDispozitiv(eveniment.target.value)}
                >
                  <option value="">Toate</option>
                  {soc.dispozitive.map((dispozitiv) => (
                    <option key={dispozitiv.device_id} value={dispozitiv.device_id}>
                      {dispozitiv.device_id}
                    </option>
                  ))}
                </select>
              </label>
            }
          >
            {evenimente.length === 0 ? (
              <StareGoala mesaj="Nu există evenimente ingerate." />
            ) : (
              <div className="tabel-container tabel-container--limitat">
                <table className="tabel tabel--compact">
                  <thead>
                    <tr>
                      <th scope="col">Ora</th>
                      <th scope="col">Seq</th>
                      <th scope="col">Dispozitiv</th>
                      <th scope="col">Eveniment</th>
                      <th scope="col">Rezultat</th>
                      <th scope="col">Sursă</th>
                      <th scope="col">Destinație</th>
                      <th scope="col">Origine</th>
                    </tr>
                  </thead>
                  <tbody>
                    {evenimente.map((eveniment) => (
                      <tr key={eveniment.event_id}>
                        <td>{formateazaOra(eveniment.occurred_at)}</td>
                        <td>{eveniment.seq}</td>
                        <td>{eveniment.device_id}</td>
                        <td>{eveniment.event_type}</td>
                        <td>{eveniment.outcome}</td>
                        <td className="tabel__monospatiat">
                          {eveniment.source.ip}
                          {eveniment.source.user && ` (${eveniment.source.user})`}
                        </td>
                        <td className="tabel__monospatiat">
                          {eveniment.target.ip}
                          {eveniment.target.port !== null && `:${eveniment.target.port}`}
                        </td>
                        <td>{ETICHETE_ORIGINE[eveniment.origin] ?? eveniment.origin}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </section>
  )
}
