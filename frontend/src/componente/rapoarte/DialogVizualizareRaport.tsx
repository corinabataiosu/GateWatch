import { descarcaPdfRaport } from '../../servicii/serviciuPdf'
import type { RaportSalvat } from '../../tipuri/raport'

interface PropsDialogVizualizareRaport {
  raport: RaportSalvat
  onInchide: () => void
}

export function DialogVizualizareRaport({
  raport,
  onInchide,
}: PropsDialogVizualizareRaport) {
  const handlePrint = () => {
    window.print()
  }

  return (
    <div
      className="dialog-fundal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="titlu-dialog-vizualizare"
      onClick={(e) => {
        if (e.target === e.currentTarget) onInchide()
      }}
    >
      <div className="dialog-continut dialog-continut--lat">
        <div className="dialog-antet">
          <div className="dialog-antet__titlu-grup">
            <span className="insigna-categorie-dialog">
              {raport.numeCategorie}
            </span>
            <h2 id="titlu-dialog-vizualizare" className="dialog-antet__titlu">
              {raport.titlu}
            </h2>
          </div>
          <button
            type="button"
            className="dialog-buton-inchidere"
            onClick={onInchide}
            aria-label="Închide fereastra"
          >
            ✕
          </button>
        </div>

        <div className="dialog-corp">
          {/* Informații Metadate */}
          <div className="raport-previzualizare__metadate">
            <div className="raport-previzualizare__meta-item">
              <span className="raport-previzualizare__meta-eticheta">Perioadă analizată:</span>
              <strong className="raport-previzualizare__meta-valoare">
                {raport.perioadaInceput} — {raport.perioadaSfarsit}
              </strong>
            </div>
            <div className="raport-previzualizare__meta-item">
              <span className="raport-previzualizare__meta-eticheta">Data generării:</span>
              <strong className="raport-previzualizare__meta-valoare">{raport.generatLa}</strong>
            </div>
            <div className="raport-previzualizare__meta-item">
              <span className="raport-previzualizare__meta-eticheta">Operator responsabil:</span>
              <strong className="raport-previzualizare__meta-valoare">{raport.generatDe}</strong>
            </div>
            <div className="raport-previzualizare__meta-item">
              <span className="raport-previzualizare__meta-eticheta">Format document:</span>
              <strong className="raport-previzualizare__meta-valoare">Document PDF (A4)</strong>
            </div>
          </div>

          {/* Rezumat Executiv */}
          <div className="raport-previzualizare__sectiune">
            <h3 className="raport-previzualizare__subtitlu">Rezumat Executiv</h3>
            <p className="raport-previzualizare__text">{raport.sumar}</p>
          </div>

          {/* Metrici Cheie */}
          {raport.statistici && raport.statistici.length > 0 && (
            <div className="raport-previzualizare__sectiune">
              <h3 className="raport-previzualizare__subtitlu">Indicatori Cheie</h3>
              <div className="raport-previzualizare__grid-statistici">
                {raport.statistici.map((st, idx) => (
                  <div key={idx} className="raport-previzualizare__card-stat">
                    <span className="raport-previzualizare__stat-eticheta">{st.eticheta}</span>
                    <strong className="raport-previzualizare__stat-valoare">{st.valoare}</strong>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tabel Date Detaliate */}
          <div className="raport-previzualizare__sectiune">
            <h3 className="raport-previzualizare__subtitlu">
              Înregistrări & Evenimente ({raport.elemente.length})
            </h3>
            <div className="raport-previzualizare__tabel-wrapper">
              <table className="tabel-raport">
                <thead>
                  <tr>
                    <th>ID / Cod</th>
                    <th>Data & Ora</th>
                    <th>Eveniment / Titlu</th>
                    <th>Severitate / Stare</th>
                    <th>Dispozitiv</th>
                    <th>Detalii</th>
                  </tr>
                </thead>
                <tbody>
                  {raport.elemente.map((el) => (
                    <tr key={el.id}>
                      <td className="tabel-raport__cod">
                        {el.id}
                      </td>
                      <td>{el.data}</td>
                      <td>
                        <strong>{el.titlu}</strong>
                      </td>
                      <td>
                        <span className="insigna-tabel-stare">
                          {el.severitate || el.stare || '-'}
                        </span>
                      </td>
                      <td>{el.dispozitiv || '-'}</td>
                      <td className="tabel-raport__detaliu">{el.detalii}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recomandări */}
          {raport.recomandari && raport.recomandari.length > 0 && (
            <div className="raport-previzualizare__sectiune">
              <h3 className="raport-previzualizare__subtitlu">Măsuri & Recomandări SOC</h3>
              <ul className="raport-previzualizare__lista-recomandari">
                {raport.recomandari.map((rec, idx) => (
                  <li key={idx}>{rec}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="dialog-subsol">
          <button
            type="button"
            className="buton-secundar"
            onClick={onInchide}
          >
            Închide
          </button>
          <button
            type="button"
            className="buton-secundar"
            onClick={handlePrint}
          >
            Tipărește
          </button>
          <button
            type="button"
            className="buton-primar"
            onClick={() => descarcaPdfRaport(raport)}
          >
            Descarcă PDF
          </button>
        </div>
      </div>
    </div>
  )
}
