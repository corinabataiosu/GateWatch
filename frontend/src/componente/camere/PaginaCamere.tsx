import { useState } from 'react'
import type { DateSoc } from '../../carlige/useDateSoc'
import {
  ETICHETE_ZONE,
  STARI_OPERATIONALE,
  STARI_SECURITATE_SOC,
  formateazaDataOra,
  stareSau,
} from '../../servicii/formatare'
import {
  Card,
  Insigna,
  MesajSocIndisponibil,
  StareGoala,
} from '../comune/ElementeSoc'
import { FluxCamera } from './FluxCamera'

/** Singura cameră cu flux video în demonstrație. */
const CAMERA_CU_FLUX = 'CAM-01'

export function PaginaCamere({ soc }: { soc: DateSoc }) {
  const camere = soc.dispozitive.filter((dispozitiv) => dispozitiv.type === 'camera')
  const [fluxDeschis, setFluxDeschis] = useState(false)

  return (
    <section className="pagina" aria-labelledby="titlu-camere">

      <FluxCamera identificator={CAMERA_CU_FLUX} deschis={fluxDeschis} onSchimba={setFluxDeschis} />

      {!soc.conectat && !soc.seIncarca ? (
        <MesajSocIndisponibil eroare={soc.eroare} />
      ) : (
        <Card titlu={`Camere (${camere.length})`}>
          {camere.length === 0 ? (
            <StareGoala mesaj="SOC nu a raportat încă nicio cameră." />
          ) : (
            <div className="tabel-container">
              <table className="tabel">
                <thead>
                  <tr>
                    <th scope="col">Cameră</th>
                    <th scope="col">Zonă</th>
                    <th scope="col">Adresă IP</th>
                    <th scope="col">Stare operațională</th>
                    <th scope="col">Stare securitate</th>
                    <th scope="col">Alerte deschise</th>
                    <th scope="col">Ultima activitate</th>
                  </tr>
                </thead>
                <tbody>
                  {camere.map((camera) => (
                    <tr
                      key={camera.device_id}
                      className={camera.device_id === CAMERA_CU_FLUX ? 'tabel__rand--actionabil' : undefined}
                      onClick={camera.device_id === CAMERA_CU_FLUX ? () => setFluxDeschis(true) : undefined}
                      title={camera.device_id === CAMERA_CU_FLUX ? 'Deschide fluxul video' : undefined}
                    >
                      <td>
                        <strong>{camera.device_id}</strong>
                        <span className="tabel__secundar">{camera.name}</span>
                      </td>
                      <td>{ETICHETE_ZONE[camera.zone] ?? camera.zone}</td>
                      <td className="tabel__monospatiat">{camera.ip}</td>
                      <td>
                        <Insigna stare={stareSau(STARI_OPERATIONALE, camera.operational_status)} />
                      </td>
                      <td>
                        <Insigna stare={stareSau(STARI_SECURITATE_SOC, camera.security_state)} />
                      </td>
                      <td>{camera.open_alerts}</td>
                      <td>{formateazaDataOra(camera.last_seen)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </section>
  )
}
