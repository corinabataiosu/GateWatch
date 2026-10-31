import type { ReactNode } from 'react'
import type { DateSoc } from '../../carlige/useDateSoc'
import {
  ORDINE_SEVERITATI,
  ORDINE_STARI_INCIDENT,
  SEVERITATI_SOC,
  STARI_INCIDENT,
  formateazaNumarIntreg,
} from '../../servicii/formatare'
import type { AlertaSoc } from '../../tipuri/soc'
import {
  AntetPagina,
  Card,
  Insigna,
  MesajSocIndisponibil,
  StareGoala,
} from '../comune/ElementeSoc'

type RandTehnica = {
  id: string
  denumire: string
  tactica: string
  numar: number
}

function tehniciObservate(alerte: AlertaSoc[]): RandTehnica[] {
  const tehnici = new Map<string, RandTehnica>()
  for (const alerta of alerte) {
    if (!alerta.mitre) {
      continue
    }
    const existenta = tehnici.get(alerta.mitre.technique_id)
    if (existenta) {
      existenta.numar += 1
    } else {
      tehnici.set(alerta.mitre.technique_id, {
        id: alerta.mitre.technique_id,
        denumire: alerta.mitre.technique,
        tactica: alerta.mitre.tactic,
        numar: 1,
      })
    }
  }
  return [...tehnici.values()].sort((a, b) => b.numar - a.numar)
}

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
  const tehnici = tehniciObservate(soc.alerte)
  const alerteReguli = soc.alerte.filter((alerta) => alerta.source === 'rule').length
  const alerteMl = soc.alerte.filter((alerta) => alerta.source === 'ml').length

  return (
    <section className="pagina" aria-labelledby="titlu-rapoarte">
      <AntetPagina
        id="titlu-rapoarte"
        eticheta="Secțiune"
        titlu="Rapoarte"
        subtitlu="Sinteza detecțiilor SOC: severități, surse de detecție, starea incidentelor și tehnici MITRE ATT&CK observate."
      />

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

          <Card titlu="Tehnici MITRE ATT&CK observate">
            {tehnici.length === 0 ? (
              <StareGoala mesaj="Nu au fost observate tehnici MITRE ATT&CK." />
            ) : (
              <div className="tabel-container">
                <table className="tabel tabel--compact">
                  <thead>
                    <tr>
                      <th scope="col">Tehnică</th>
                      <th scope="col">Denumire</th>
                      <th scope="col">Tactică</th>
                      <th scope="col">Alerte</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tehnici.map((tehnica) => (
                      <tr key={tehnica.id}>
                        <td className="tabel__monospatiat">{tehnica.id}</td>
                        <td>{tehnica.denumire}</td>
                        <td>{tehnica.tactica}</td>
                        <td className="tabel__numar">{tehnica.numar}</td>
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
