import { useMemo, useState } from 'react'
import { ScenaAeroport } from '../aeroport/ScenaAeroport'
import { PaginaCamere } from '../camere/PaginaCamere'
import { EvenimenteRecente } from '../comune/EvenimenteRecente'
import { IndicatoriSoc } from '../comune/IndicatoriSoc'
import { PaginaIncidente } from '../incidente/PaginaIncidente'
import { PaginaRapoarte } from '../rapoarte/PaginaRapoarte'
import { useCameraDemonstrativa } from '../../carlige/useCameraDemonstrativa'
import { useDateSoc, type DateSoc } from '../../carlige/useDateSoc'
import { IDENTIFICATOR_CAMERA_DEMONSTRATIVA } from '../../dateSimulate/cameraSimulata'
import { construiesteCameraDinSoc } from '../../servicii/serviciuCamera'
import { Antet } from './Antet'
import { MeniuLateral, type IdPagina } from './MeniuLateral'

function PanouPrincipal({ soc }: { soc: DateSoc }) {
  const { camera: cameraDemonstrativa } = useCameraDemonstrativa()

  const dispozitivCamera = soc.conectat
    ? soc.dispozitive.find(
        (dispozitiv) => dispozitiv.device_id === IDENTIFICATOR_CAMERA_DEMONSTRATIVA,
      )
    : undefined

  // Cu SOC disponibil, starea CAM-01 vine din SOC; altfel se folosește scenariul demonstrativ local.
  const cameraSoc = useMemo(
    () => (dispozitivCamera ? construiesteCameraDinSoc(dispozitivCamera, soc.alerte) : null),
    [dispozitivCamera, soc.alerte],
  )
  const camera = cameraSoc ?? cameraDemonstrativa

  return (
    <section className="pagina" aria-labelledby="titlu-panou">
      {soc.conectat ? (
        <IndicatoriSoc soc={soc} />
      ) : (
        <p className="anunt-mod-demonstrativ" role="status">
          <strong>Mod demonstrativ.</strong>{' '}
          {soc.seIncarca
            ? 'Se verifică conexiunea cu SOC...'
            : 'Backend-ul SOC nu este accesibil; camera CAM-01 afișează scenarii locale simulate.'}
        </p>
      )}

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

        <ScenaAeroport stareCamera={camera} dispozitiveSoc={soc.conectat ? soc.dispozitive : []} />
      </div>

      {soc.conectat && <EvenimenteRecente soc={soc} />}
    </section>
  )
}

function ContinutPagina({ pagina, soc }: { pagina: IdPagina; soc: DateSoc }) {
  switch (pagina) {
    case 'panou':
      return <PanouPrincipal soc={soc} />
    case 'camere':
      return <PaginaCamere soc={soc} />
    case 'incidente':
      return <PaginaIncidente soc={soc} />
    case 'rapoarte':
      return <PaginaRapoarte soc={soc} />
  }
}

export function StructuraAplicatiei() {
  const [paginaActiva, setPaginaActiva] = useState<IdPagina>('panou')
  const soc = useDateSoc()

  return (
    <div className="structura-aplicatie">
      <a className="sari-la-continut" href="#continut-principal">
        Sari la conținutul principal
      </a>

      <Antet socConectat={soc.conectat} seIncarca={soc.seIncarca} />

      <div className="corp-aplicatie">
        <MeniuLateral
          paginaActiva={paginaActiva}
          onSchimbaPagina={setPaginaActiva}
        />

        <main id="continut-principal" className="continut-principal" tabIndex={-1}>
          <ContinutPagina pagina={paginaActiva} soc={soc} />
        </main>
      </div>
    </div>
  )
}
