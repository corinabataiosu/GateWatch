import type { ReactNode } from 'react'
import type { DateSoc } from '../../carlige/useDateSoc'
import {
  ORDINE_SEVERITATI,
  ORDINE_STARI_INCIDENT,
  SEVERITATI_SOC,
  STARI_INCIDENT,
  formateazaNumarIntreg,
} from '../../servicii/formatare'
import {
  AntetPagina,
  Card,
  Insigna,
  MesajSocIndisponibil,
} from '../comune/ElementeSoc'
import { RaportGenerat } from './RaportGenerat'

function exportaJson(soc: DateSoc) {
  const continut = {
    generat_la: new Date().toISOString(),
    prezentare: soc.prezentare,
    incidente: soc.incidente,
    alerte: soc.alerte,
  }
  const blob = new Blob([JSON.stringify(continut, null, 2)], { type: 'application/json' })
  const adresa = URL.createObjectURL(blob)
  const legatura = document.createElement('a')
  legatura.href = adresa
  legatura.download = `gatewatch-raport-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`
  legatura.click()
  URL.revokeObjectURL(adresa)
}

function TabelNumarare({ randuri }: { randuri: { cheie: string; eticheta: ReactNode; numar: number }[] }) {
  return (
    <table className="tabel tabel--compact">
      <tbody>
        {randuri.map((rand) => (
          <tr key={rand.cheie}>
            <td>{rand.eticheta}</td>
            <td className="tabel__numar">{formateazaNumarIntreg(rand.numar)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function PaginaRapoarte({ soc }: { soc: DateSoc }) {
  const alerteReguli = soc.alerte.filter((alerta) => alerta.source === 'rule').length
  const alerteMl = soc.alerte.filter((alerta) => alerta.source === 'ml').length

  return (
    <section className="pagina" aria-labelledby="titlu-rapoarte">

      {!soc.conectat && !soc.seIncarca ? (
        <MesajSocIndisponibil eroare={soc.eroare} />
      ) : (
        <>
          <div className="bara-actiuni">
            <button
              type="button"
              className="buton-actiune"
              onClick={() => exportaJson(soc)}
              disabled={!soc.conectat}
            >
              Export JSON
            </button>
            <span className="tabel__secundar">
              {formateazaNumarIntreg(soc.incidente.length)} incidente ·{' '}
              {formateazaNumarIntreg(soc.alerte.length)} alerte
            </span>
          </div>

          <RaportGenerat conectat={soc.conectat} />

          <div className="grila-rapoarte">
            <Card titlu="Alerte deschise pe severitate">
              <TabelNumarare
                randuri={ORDINE_SEVERITATI.map((severitate) => ({
                  cheie: severitate,
                  eticheta: <Insigna stare={SEVERITATI_SOC[severitate]} />,
                  numar: soc.prezentare?.severity_counts[severitate] ?? 0,
                }))}
              />
            </Card>

            <Card titlu="Alerte pe sursa detecției">
              <TabelNumarare
                randuri={[
                  { cheie: 'rule', eticheta: 'Reguli de detecție', numar: alerteReguli },
                  { cheie: 'ml', eticheta: 'Model ML (Isolation Forest)', numar: alerteMl },
                ]}
              />
            </Card>

            <Card titlu="Incidente pe stare">
              <TabelNumarare
                randuri={ORDINE_STARI_INCIDENT.map((stare) => ({
                  cheie: stare,
                  eticheta: <Insigna stare={STARI_INCIDENT[stare]} />,
                  numar: soc.incidente.filter((incident) => incident.status === stare).length,
                }))}
              />
            </Card>
          </div>

        </>
      )}
    </section>
  )
}
