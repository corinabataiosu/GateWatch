import { useState } from 'react'
import { ScenaAeroport } from '../aeroport/ScenaAeroport'
import { PanouStareCamera } from '../camere/PanouStareCamera'
import { useCameraDemonstrativa } from '../../carlige/useCameraDemonstrativa'
import { Antet } from './Antet'
import { MeniuLateral, type IdPagina } from './MeniuLateral'

type DetaliiPaginaTemporara = {
  titlu: string
  mesaj: string
}

type PaginaFaraPanou = Exclude<IdPagina, 'panou'>

const PAGINI_TEMPORARE: Record<PaginaFaraPanou, DetaliiPaginaTemporara> = {
  camere: {
    titlu: 'Camere',
    mesaj:
      'Modulul de monitorizare a camerelor este în pregătire. Aici vor fi afișate starea și fluxurile video ale echipamentelor de supraveghere.',
  },
  incidente: {
    titlu: 'Incidente',
    mesaj:
      'Modulul de incidente este în pregătire. Aici vor fi centralizate alertele și evenimentele semnalate în aeroport.',
  },
  retea: {
    titlu: 'Rețea',
    mesaj:
      'Modulul de rețea este în pregătire. Aici va fi afișată starea infrastructurii și a echipamentelor conectate.',
  },
  rapoarte: {
    titlu: 'Rapoarte',
    mesaj:
      'Modulul de rapoarte este în pregătire. Aici vor putea fi generate și consultate rapoarte operaționale.',
  },
}

function PanouPrincipal() {
  const {
    camera,
    scenariu,
    seteazaScenariu,
    revinoLaNormal,
  } = useCameraDemonstrativa()

  return (
    <section className="pagina" aria-labelledby="titlu-panou">
      <header className="pagina__antet">
        <p className="pagina__eticheta">Panou principal</p>
        <h1 id="titlu-panou" className="pagina__titlu">
          Prezentare generală a aeroportului
        </h1>
        <p className="pagina__subtitlu">
          Monitorizarea securității și disponibilității sistemelor de supraveghere
        </p>
      </header>

      <div
        className="spatiu-3d"
        role="region"
        aria-label="Vizualizare 3D a aeroportului"
      >
        <div className="spatiu-3d__bara">
          <span className="spatiu-3d__eticheta">Vizualizare 3D</span>
          <span className="spatiu-3d__stare spatiu-3d__stare--activ">
            Interactiv
          </span>
        </div>

        <ScenaAeroport stareCamera={camera} />
      </div>

      <PanouStareCamera
        camera={camera}
        scenariu={scenariu}
        onSchimbaScenariu={seteazaScenariu}
        onRevinoLaNormal={revinoLaNormal}
      />
    </section>
  )
}

function ContinutTemporar({ pagina }: { pagina: PaginaFaraPanou }) {
  const detalii = PAGINI_TEMPORARE[pagina]

  return (
    <section className="pagina" aria-labelledby={`titlu-${pagina}`}>
      <header className="pagina__antet">
        <p className="pagina__eticheta">Secțiune</p>
        <h1 id={`titlu-${pagina}`} className="pagina__titlu">
          {detalii.titlu}
        </h1>
      </header>

      <div className="pagina-temporara">
        <span className="pagina-temporara__eticheta">În pregătire</span>
        <p className="pagina-temporara__mesaj">{detalii.mesaj}</p>
      </div>
    </section>
  )
}

export function StructuraAplicatiei() {
  const [paginaActiva, setPaginaActiva] = useState<IdPagina>('panou')

  return (
    <div className="structura-aplicatie">
      <a className="sari-la-continut" href="#continut-principal">
        Sari la conținutul principal
      </a>

      <Antet />

      <div className="corp-aplicatie">
        <MeniuLateral
          paginaActiva={paginaActiva}
          onSchimbaPagina={setPaginaActiva}
        />

        <main id="continut-principal" className="continut-principal" tabIndex={-1}>
          {paginaActiva === 'panou' ? (
            <PanouPrincipal />
          ) : (
            <ContinutTemporar pagina={paginaActiva} />
          )}
        </main>
      </div>
    </div>
  )
}
