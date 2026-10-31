import { useState, type FormEvent } from 'react'
import type { CategorieRaport, ParametriGenerareRaport } from '../../tipuri/raport'

interface PropsDialogGenerareRaport {
  categorie: CategorieRaport
  onInchide: () => void
  onGenereaza: (parametri: ParametriGenerareRaport) => void
}

function obtineDataAcumFormat(): string {
  const acum = new Date()
  const offset = acum.getTimezoneOffset()
  const local = new Date(acum.getTime() - offset * 60 * 1000)
  return local.toISOString().slice(0, 16)
}

function obtineDataTrecutFormat(zileInUrma: number): string {
  const d = new Date()
  d.setDate(d.getDate() - zileInUrma)
  const offset = d.getTimezoneOffset()
  const local = new Date(d.getTime() - offset * 60 * 1000)
  return local.toISOString().slice(0, 16)
}

export function DialogGenerareRaport({
  categorie,
  onInchide,
  onGenereaza,
}: PropsDialogGenerareRaport) {
  const [dataInceput, setDataInceput] = useState<string>(() => obtineDataTrecutFormat(7))
  const [dataSfarsit, setDataSfarsit] = useState<string>(() => obtineDataAcumFormat())
  const [titluPersonalizat, setTitluPersonalizat] = useState<string>(
    `Raport ${categorie.titlu} - ${new Date().toLocaleDateString('ro-RO')} ${new Date().toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}`
  )
  const [operator, setOperator] = useState<string>('Petrescu Răzvan')
  const [seProceseaza, setSeProceseaza] = useState<boolean>(false)

  const seteazaIntervalRapid = (zile: number) => {
    setDataInceput(obtineDataTrecutFormat(zile))
    setDataSfarsit(obtineDataAcumFormat())
  }

  const handleTrimite = (e: FormEvent) => {
    e.preventDefault()
    setSeProceseaza(true)
    setTimeout(() => {
      onGenereaza({
        categorie: categorie.id,
        perioadaInceput: dataInceput.replace('T', ' '),
        perioadaSfarsit: dataSfarsit.replace('T', ' '),
        titlu: titluPersonalizat,
        generatDe: operator,
      })
      setSeProceseaza(false)
      onInchide()
    }, 250)
  }

  return (
    <div
      className="dialog-fundal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="titlu-dialog-generare"
      onClick={(e) => {
        if (e.target === e.currentTarget) onInchide()
      }}
    >
      <div className="dialog-continut">
        <div className="dialog-antet">
          <div className="dialog-antet__titlu-grup">
            <span className="insigna-categorie-dialog">
              {categorie.titlu}
            </span>
            <h2 id="titlu-dialog-generare" className="dialog-antet__titlu">
              Generare Raport Nou
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

        <form onSubmit={handleTrimite} className="dialog-corp">
          <p className="dialog-descriere">
            Specificați perioada de început și de sfârșit pentru extragerea și corelarea
            datelor în noul raport PDF.
          </p>

          {/* Presetări rapide */}
          <div className="intervale-rapide">
            <span className="intervale-rapide__eticheta">Presetări rapide:</span>
            <div className="intervale-rapide__butoane">
              <button
                type="button"
                className="buton-chip"
                onClick={() => seteazaIntervalRapid(1)}
              >
                Ultimele 24h
              </button>
              <button
                type="button"
                className="buton-chip"
                onClick={() => seteazaIntervalRapid(7)}
              >
                Ultimele 7 zile
              </button>
              <button
                type="button"
                className="buton-chip"
                onClick={() => seteazaIntervalRapid(30)}
              >
                Ultima lună
              </button>
              <button
                type="button"
                className="buton-chip"
                onClick={() => {
                  setDataInceput('2026-01-01T00:00')
                  setDataSfarsit(obtineDataAcumFormat())
                }}
              >
                Tot anul
              </button>
            </div>
          </div>

          <div className="campuri-perioada">
            <div className="camp-formular">
              <label htmlFor="perioada-inceput" className="camp-formular__eticheta">
                Perioadă de început (Data și ora) *
              </label>
              <input
                id="perioada-inceput"
                type="datetime-local"
                className="camp-formular__input"
                value={dataInceput}
                onChange={(e) => setDataInceput(e.target.value)}
                required
              />
            </div>

            <div className="camp-formular">
              <label htmlFor="perioada-sfarsit" className="camp-formular__eticheta">
                Perioadă de sfârșit (Data și ora) *
              </label>
              <input
                id="perioada-sfarsit"
                type="datetime-local"
                className="camp-formular__input"
                value={dataSfarsit}
                onChange={(e) => setDataSfarsit(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="camp-formular">
            <label htmlFor="titlu-raport" className="camp-formular__eticheta">
              Titlu raport (opțional)
            </label>
            <input
              id="titlu-raport"
              type="text"
              className="camp-formular__input"
              value={titluPersonalizat}
              onChange={(e) => setTitluPersonalizat(e.target.value)}
              placeholder="Introduceți titlul raportului..."
            />
          </div>

          <div className="camp-formular">
            <label htmlFor="operator-raport" className="camp-formular__eticheta">
              Nume operator / Analist responsabil
            </label>
            <input
              id="operator-raport"
              type="text"
              className="camp-formular__input"
              value={operator}
              onChange={(e) => setOperator(e.target.value)}
              placeholder="Numele analistului..."
            />
          </div>

          <div className="dialog-subsol">
            <button
              type="button"
              className="buton-secundar"
              onClick={onInchide}
              disabled={seProceseaza}
            >
              Anulează
            </button>
            <button
              type="submit"
              className="buton-primar"
              disabled={seProceseaza}
            >
              {seProceseaza ? 'Se generează PDF...' : 'Generează Raport PDF'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
