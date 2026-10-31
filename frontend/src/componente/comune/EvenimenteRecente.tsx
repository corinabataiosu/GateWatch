import { useEffect, useState } from 'react'
import type { DateSoc } from '../../carlige/useDateSoc'
import { obtineEvenimente } from '../../servicii/clientSoc'
import { formateazaOra } from '../../servicii/formatare'
import type { EvenimentSoc } from '../../tipuri/soc'
import { Card, StareGoala } from './ElementeSoc'

const ETICHETE_ORIGINE: Record<EvenimentSoc['origin'], string> = {
  synthetic: 'Trafic de bază',
  scenario_generated: 'Scenariu',
  observed_http: 'Cerere HTTP reală',
}

/** Ultimele evenimente ingerate de SOC, cu filtru pe dispozitiv. */
export function EvenimenteRecente({ soc }: { soc: DateSoc }) {
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
  )
}
