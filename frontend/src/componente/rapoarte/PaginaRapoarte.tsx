import { useState, type ReactNode } from 'react'
import type { DateSoc } from '../../carlige/useDateSoc'
import { EroareSoc, genereazaRaport } from '../../servicii/clientSoc'
import {
  ORDINE_SEVERITATI,
  ORDINE_STARI_INCIDENT,
  SEVERITATI_SOC,
  STARI_INCIDENT,
  formateazaDataOra,
  formateazaNumarIntreg,
} from '../../servicii/formatare'
import { descarcaPdfRaport } from '../../servicii/serviciuPdf'
import { incarcaRapoarte, salveazaRaport, stergeRaport } from '../../servicii/serviciuRapoarte'
import type { RaportSoc } from '../../tipuri/soc'
import {
  Card,
  Insigna,
  MesajSocIndisponibil,
  StareGoala,
} from '../comune/ElementeSoc'
import { RaportGenerat } from './RaportGenerat'

function descarcaJson(raport: RaportSoc) {
  const blob = new Blob([JSON.stringify(raport, null, 2)], { type: 'application/json' })
  const adresa = URL.createObjectURL(blob)
  const legatura = document.createElement('a')
  legatura.href = adresa
  legatura.download = `gatewatch-raport-${raport.generated_at.slice(0, 19).replace(/[:T]/g, '-')}.json`
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
  const [rapoarte, setRapoarte] = useState<RaportSoc[]>(incarcaRapoarte)
  const [selectat, setSelectat] = useState<RaportSoc | null>(() => rapoarte[0] ?? null)
  const [seGenereaza, setSeGenereaza] = useState(false)
  const [eroare, setEroare] = useState<string | null>(null)

  const genereaza = async () => {
    setSeGenereaza(true)
    setEroare(null)
    try {
      const raport = await genereazaRaport()
      setRapoarte(salveazaRaport(raport))
      setSelectat(raport)
    } catch (e) {
      setEroare(e instanceof EroareSoc ? e.message : 'Raportul nu a putut fi generat.')
    } finally {
      setSeGenereaza(false)
    }
  }

  const sterge = (raport: RaportSoc) => {
    if (!window.confirm(`Ștergeți raportul generat la ${formateazaDataOra(raport.generated_at)}?`)) {
      return
    }
    setRapoarte(stergeRaport(raport.generated_at))
    if (selectat?.generated_at === raport.generated_at) {
      setSelectat(null)
    }
  }

  const alerteReguli = soc.alerte.filter((alerta) => alerta.source === 'rule').length
  const alerteMl = soc.alerte.filter((alerta) => alerta.source === 'ml').length

  return (
    <section className="pagina" aria-label="Rapoarte">
      {!soc.conectat && !soc.seIncarca && <MesajSocIndisponibil eroare={soc.eroare} />}

      <Card
        titlu="Raport de activitate"
        actiuni={
          <button
            type="button"
            className="buton-actiune"
            onClick={genereaza}
            disabled={!soc.conectat || seGenereaza}
          >
            {seGenereaza ? 'Se generează...' : 'Generează raport'}
          </button>
        }
      >
        {eroare && (
          <p className="raport__eroare" role="alert">
            {eroare}
          </p>
        )}
        {selectat ? (
          <>
            <div className="bara-actiuni">
              <button type="button" className="buton-actiune" onClick={() => descarcaPdfRaport(selectat)}>
                Descarcă PDF
              </button>
              <button
                type="button"
                className="buton-actiune buton-actiune--secundar"
                onClick={() => descarcaJson(selectat)}
              >
                Export JSON
              </button>
              <span className="tabel__secundar">
                Generat la {formateazaDataOra(selectat.generated_at)}
              </span>
            </div>
            <RaportGenerat raport={selectat} />
          </>
        ) : (
          <StareGoala mesaj="Generați un raport din datele curente ale SOC sau deschideți unul salvat." />
        )}
      </Card>

      <Card titlu={`Rapoarte salvate (${rapoarte.length})`}>
        {rapoarte.length === 0 ? (
          <StareGoala mesaj="Niciun raport salvat. Rapoartele generate se păstrează în acest browser." />
        ) : (
          <table className="tabel tabel--compact">
            <thead>
              <tr>
                <th>Generat la</th>
                <th>Evenimente</th>
                <th>Alerte</th>
                <th>Incidente</th>
                <th>Dispozitive la risc</th>
                <th aria-label="Acțiuni" />
              </tr>
            </thead>
            <tbody>
              {rapoarte.map((raport) => (
                <tr key={raport.generated_at}>
                  <td>
                    {formateazaDataOra(raport.generated_at)}
                    {raport.generated_at === selectat?.generated_at && (
                      <span className="tabel__secundar"> · afișat</span>
                    )}
                  </td>
                  <td className="tabel__numar">{formateazaNumarIntreg(raport.totals.events)}</td>
                  <td className="tabel__numar">{formateazaNumarIntreg(raport.totals.alerts)}</td>
                  <td className="tabel__numar">{formateazaNumarIntreg(raport.totals.incidents)}</td>
                  <td className="tabel__numar">{formateazaNumarIntreg(raport.totals.devices_at_risk)}</td>
                  <td>
                    <div className="grup-butoane">
                      <button
                        type="button"
                        className="buton-actiune buton-actiune--secundar"
                        onClick={() => setSelectat(raport)}
                      >
                        Vezi
                      </button>
                      <button
                        type="button"
                        className="buton-actiune buton-actiune--secundar"
                        onClick={() => descarcaPdfRaport(raport)}
                      >
                        PDF
                      </button>
                      <button
                        type="button"
                        className="buton-actiune buton-actiune--secundar"
                        onClick={() => sterge(raport)}
                      >
                        Șterge
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {soc.conectat && (
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
      )}
    </section>
  )
}
