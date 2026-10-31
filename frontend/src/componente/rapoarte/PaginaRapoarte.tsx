import { useState, type ReactNode } from 'react'
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
import { DialogGenerareRaport } from './DialogGenerareRaport'
import { DialogVizualizareRaport } from './DialogVizualizareRaport'
import { descarcaPdfRaport } from '../../servicii/serviciuPdf'
import {
  CATEGORII_RAPORT,
  genereazaRaportNou,
  incarcaRapoarteSalvate,
  stergeRaportSalvat,
} from '../../servicii/serviciuRapoarte'
import type {
  CategorieRaport,
  ParametriGenerareRaport,
  RaportSalvat,
} from '../../tipuri/raport'

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

export function PaginaRapoarte({ soc }: { soc?: DateSoc }) {
  const [rapoarte, setRapoarte] = useState<RaportSalvat[]>(() => incarcaRapoarteSalvate())
  const [categorieSelectata, setCategorieSelectata] = useState<CategorieRaport | null>(null)
  const [raportVizualizat, setRaportVizualizat] = useState<RaportSalvat | null>(null)
  const [raportDeSters, setRaportDeSters] = useState<RaportSalvat | null>(null)
  const [mesajNotificare, setMesajNotificare] = useState<string | null>(null)

  const afiseazaNotificare = (mesaj: string) => {
    setMesajNotificare(mesaj)
    setTimeout(() => {
      setMesajNotificare(null)
    }, 4000)
  }

  const handleGenereaza = (parametri: ParametriGenerareRaport) => {
    const nou = genereazaRaportNou(parametri)
    setRapoarte((prev) => [nou, ...prev.filter((r) => r.id !== nou.id)])
    afiseazaNotificare(`Raportul „${nou.titlu}” a fost generat și salvat cu succes.`)
  }

  const confirmaStergere = () => {
    if (!raportDeSters) return
    const actualizate = stergeRaportSalvat(raportDeSters.id)
    setRapoarte(actualizate)
    afiseazaNotificare(`Raportul a fost șters din listă.`)
    setRaportDeSters(null)
  }

  const alerteReguli = soc ? soc.alerte.filter((alerta) => alerta.source === 'rule').length : 0
  const alerteMl = soc ? soc.alerte.filter((alerta) => alerta.source === 'ml').length : 0

  return (
    <section className="pagina" aria-labelledby="titlu-rapoarte">

      {/* 1. Secțiune Generare Raport PDF pe Categorii */}
      <div className="panou-rapoarte">
        <div className="panou-rapoarte__antet">
          <span className="panou-rapoarte__pictograma" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              width="20"
              height="20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="16" />
              <line x1="8" y1="12" x2="16" y2="12" />
            </svg>
          </span>
          <h2 className="panou-rapoarte__titlu">Generare Raport</h2>
        </div>

        <div className="categorii-rapoarte-grila" role="group" aria-label="Categorii de rapoarte disponibile">
          {CATEGORII_RAPORT.map((cat) => (
            <button
              key={cat.id}
              type="button"
              className="buton-categorie"
              onClick={() => setCategorieSelectata(cat)}
              title={cat.subtitlu}
            >
              <span className="buton-categorie__icon" aria-hidden="true">
                {cat.id === 'utilizatori' && (
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                )}
                {cat.id === 'incidente' && (
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                )}
                {cat.id === 'dispozitive' && (
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                    <line x1="8" y1="21" x2="16" y2="21" />
                    <line x1="12" y1="17" x2="12" y2="21" />
                  </svg>
                )}
                {cat.id === 'alerte' && (
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                )}
                {cat.id === 'retea' && (
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                  </svg>
                )}
                {cat.id === 'ml' && (
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                  </svg>
                )}
                {cat.id === 'audit' && (
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="m22 2-7 20-4-9-9-4Z" />
                    <path d="M22 2 11 13" />
                  </svg>
                )}
              </span>
              <span className="buton-categorie__titlu">{cat.titlu}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 2. Secțiune Rapoarte Salvate */}
      <div className="panou-rapoarte">
        <div className="panou-rapoarte__antet">
          <span className="panou-rapoarte__pictograma" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              width="20"
              height="20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="21 8 21 21 3 21 3 8" />
              <rect x="1" y="3" width="22" height="5" />
              <line x1="10" y1="12" x2="14" y2="12" />
            </svg>
          </span>
          <h2 className="panou-rapoarte__titlu">Rapoarte Salvate</h2>
          <span className="panou-rapoarte__contor">({rapoarte.length})</span>
        </div>

        {rapoarte.length === 0 ? (
          <div className="stare-goala-rapoarte">
            <p>Nu există rapoarte generate încă.</p>
            <p className="stare-goala-rapoarte__sub">
              Selectați una dintre categoriile de mai sus pentru a genera un raport PDF.
            </p>
          </div>
        ) : (
          <div className="lista-rapoarte-salvate">
            {rapoarte.map((raport) => (
              <div key={raport.id} className="card-raport-salvat">
                <div className="card-raport-salvat__continut">
                  <h3 className="card-raport-salvat__titlu">{raport.titlu}</h3>
                  <div className="card-raport-salvat__metadate">
                    <span className="card-raport-salvat__meta-item">
                      <svg
                        viewBox="0 0 24 24"
                        width="14"
                        height="14"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        aria-hidden="true"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                      {raport.generatLa}
                    </span>
                    <span className="card-raport-salvat__separator">·</span>
                    <span className="card-raport-salvat__meta-item">
                      <svg
                        viewBox="0 0 24 24"
                        width="14"
                        height="14"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        aria-hidden="true"
                      >
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                      {raport.generatDe}
                    </span>
                    {raport.perioadaInceput && (
                      <>
                        <span className="card-raport-salvat__separator">·</span>
                        <span className="card-raport-salvat__perioada">
                          Perioadă: {raport.perioadaInceput.slice(0, 10)} — {raport.perioadaSfarsit.slice(0, 10)}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="card-raport-salvat__actiuni">
                  <button
                    type="button"
                    className="buton-actiune-raport buton-actiune-raport--vezi"
                    onClick={() => setRaportVizualizat(raport)}
                    title="Vizualizează raportul în aplicație"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="15"
                      height="15"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      aria-hidden="true"
                    >
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                    <span>Vezi</span>
                  </button>

                  <button
                    type="button"
                    className="buton-actiune-raport buton-actiune-raport--pdf"
                    onClick={() => descarcaPdfRaport(raport)}
                    title="Descarcă fișierul PDF"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="15"
                      height="15"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      aria-hidden="true"
                    >
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                    <span>PDF</span>
                  </button>

                  <button
                    type="button"
                    className="buton-actiune-raport buton-actiune-raport--sterge"
                    onClick={() => setRaportDeSters(raport)}
                    title="Șterge raportul"
                    aria-label="Șterge raportul"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="15"
                      height="15"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      aria-hidden="true"
                    >
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3. Secțiune Raport SOC (dacă SOC este activ/conectat) */}
      {soc && (
        <>
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
        </>
      )}

      {/* Modal Dialog Generare Raport */}
      {categorieSelectata && (
        <DialogGenerareRaport
          categorie={categorieSelectata}
          onInchide={() => setCategorieSelectata(null)}
          onGenereaza={handleGenereaza}
        />
      )}

      {/* Modal Dialog Vizualizare Raport */}
      {raportVizualizat && (
        <DialogVizualizareRaport
          raport={raportVizualizat}
          onInchide={() => setRaportVizualizat(null)}
        />
      )}

      {/* Modal Confirmare Ștergere */}
      {raportDeSters && (
        <div
          className="dialog-fundal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="titlu-confirmare-stergere"
          onClick={(e) => {
            if (e.target === e.currentTarget) setRaportDeSters(null)
          }}
        >
          <div className="dialog-continut dialog-continut--mic">
            <div className="dialog-antet">
              <h2 id="titlu-confirmare-stergere" className="dialog-antet__titlu">
                Confirmare Ștergere
              </h2>
              <button
                type="button"
                className="dialog-buton-inchidere"
                onClick={() => setRaportDeSters(null)}
              >
                ✕
              </button>
            </div>
            <div className="dialog-corp">
              <p className="dialog-descriere">
                Sunteți sigur că doriți să ștergeți raportul:
              </p>
              <p><strong>{raportDeSters.titlu}</strong></p>
            </div>
            <div className="dialog-subsol">
              <button
                type="button"
                className="buton-secundar"
                onClick={() => setRaportDeSters(null)}
              >
                Anulează
              </button>
              <button
                type="button"
                className="buton-alerta"
                onClick={confirmaStergere}
              >
                Șterge Raportul
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
