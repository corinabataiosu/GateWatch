import type { ReactNode } from 'react'
import type { StareAfisata } from '../../servicii/formatare'

/** Insignă compactă pentru stări și severități. */
export function Insigna({ stare }: { stare: StareAfisata }) {
  return <span className={`insigna insigna--${stare.clasa}`}>{stare.eticheta}</span>
}

/** Card de suprafață folosit de paginile SOC. */
export function Card({
  titlu,
  actiuni,
  children,
}: {
  titlu?: string
  actiuni?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="card">
      {(titlu || actiuni) && (
        <header className="card__antet">
          {titlu && <h2 className="card__titlu">{titlu}</h2>}
          {actiuni && <div className="card__actiuni">{actiuni}</div>}
        </header>
      )}
      {children}
    </section>
  )
}

/** Mesaj afișat când nu există date de prezentat. */
export function StareGoala({ mesaj }: { mesaj: string }) {
  return <p className="stare-goala">{mesaj}</p>
}

/** Mesaj afișat când backend-ul SOC nu este accesibil. */
export function MesajSocIndisponibil({ eroare }: { eroare: string | null }) {
  return (
    <div className="mesaj-soc" role="status">
      <p className="mesaj-soc__titlu">Backend-ul SOC nu este accesibil</p>
      <p className="mesaj-soc__text">
        Datele din această secțiune provin exclusiv din SOC. Porniți serviciul{' '}
        <code>soc-backend</code> (port 8000) și simulatorul (port 8001); pagina
        se actualizează automat.
      </p>
      {eroare && <p className="mesaj-soc__detaliu">Detaliu: {eroare}</p>}
    </div>
  )
}

/** Antetul standard al unei pagini. */
export function AntetPagina({
  titlu,
  subtitlu,
  id,
}: {
  titlu: string
  subtitlu?: string
  id: string
}) {
  return (
    <header className="pagina__antet">
      <h1 id={id} className="pagina__titlu">
        {titlu}
      </h1>
      {subtitlu && <p className="pagina__subtitlu">{subtitlu}</p>}
    </header>
  )
}
