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
import type { RaportSoc } from '../../tipuri/soc'
import {
  Card,
  Insigna,
  MesajSocIndisponibil,
  StareGoala,
} from '../comune/ElementeSoc'
import { RaportGenerat } from './RaportGenerat'

function descarcaJson(raport: RaportSoc) {
  const dateExport = raport.continut === 'incidente'
    ? { generated_at: raport.generated_at, filters: raport.filters, interval_selectat: raport.interval_selectat, incidents: raport.incidents }
    : raport.continut === 'dispozitive'
      ? { generated_at: raport.generated_at, filters: raport.filters, interval_selectat: raport.interval_selectat, nota: 'Stările dispozitivelor sunt cele curente la generare.', devices: raport.devices }
      : raport
  const blob = new Blob([JSON.stringify(dateExport, null, 2)], { type: 'application/json' })
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
  const [selectat, setSelectat] = useState<RaportSoc | null>(null)
  const [deLa, setDeLa] = useState('')
  const [panaLa, setPanaLa] = useState('')
  const [continut, setContinut] = useState<'toate' | 'incidente' | 'dispozitive'>('toate')
  const intervalInvalid = !deLa || !panaLa || deLa > panaLa
  const [seGenereaza, setSeGenereaza] = useState(false)
  const [eroare, setEroare] = useState<string | null>(null)

  const genereaza = async () => {
    if (intervalInvalid || seGenereaza) return
    setSeGenereaza(true)
    setEroare(null)
    try {
      const inceput = new Date(deLa + 'T00:00:00')
      const sfarsit = new Date(panaLa + 'T00:00:00')
      sfarsit.setDate(sfarsit.getDate() + 1)
      const raport = await genereazaRaport(inceput.toISOString(), sfarsit.toISOString())
      if (!raport.filters) throw new Error('Repornește backendul SOC pentru a activa filtrarea rapoartelor.')
      setSelectat({ ...raport, continut, interval_selectat: { deLa, panaLa } })
    } catch (e) {
      setEroare(e instanceof Error || e instanceof EroareSoc ? e.message : 'Raportul nu a putut fi generat.')
    } finally {
      setSeGenereaza(false)
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
            disabled={!soc.conectat || seGenereaza || intervalInvalid}
          >
            {seGenereaza ? 'Se generează...' : 'Generează raport'}
          </button>
        }
      >
        <fieldset className="raport-filtre" disabled={seGenereaza}>
          <legend>Configurează documentul</legend>
          <label>De la data<input type="date" value={deLa} max={panaLa || undefined} onChange={e => setDeLa(e.target.value)} required /></label>
          <label>Până la data<input type="date" value={panaLa} min={deLa || undefined} onChange={e => setPanaLa(e.target.value)} required /></label>
          <label>Conținutul raportului<select value={continut} onChange={e => setContinut(e.target.value as typeof continut)}>
            <option value="toate">Toate datele</option><option value="incidente">Doar incidente</option><option value="dispozitive">Doar dispozitive</option>
          </select></label>
          {deLa && panaLa && deLa > panaLa && <p role="alert">Data de început trebuie să fie înaintea datei de sfârșit sau egală cu aceasta.</p>}
        </fieldset>
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
          <StareGoala mesaj="Selectați intervalul și conținutul, apoi generați raportul." />
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
