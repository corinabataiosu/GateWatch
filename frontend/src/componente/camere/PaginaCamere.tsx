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
import { rezolvaAvertizareCamera } from '../../servicii/clientSoc'
import { stareImagine } from '../../servicii/stareImagine'

/** Singura cameră cu flux video în demonstrație. */
const CAMERA_CU_FLUX = 'CAM-01'

export function PaginaCamere({ soc }: { soc: DateSoc }) {
  const camere = soc.dispozitive.filter((dispozitiv) => dispozitiv.type === 'camera')
  const [fluxDeschis, setFluxDeschis] = useState(false)
  const [inLucru, setInLucru] = useState<string | null>(null)
  const [mesaj, setMesaj] = useState<string | null>(null)
  const [eroare, setEroare] = useState<string | null>(null)

  const rezolva = async (id: string) => {
    if (inLucru) return
    setInLucru(id)
    setMesaj(null)
    setEroare(null)
    try {
      const rezultat = await rezolvaAvertizareCamera(id)
      setMesaj(`${id}: ${rezultat.closed_alerts} alerte fără incident închise. Dacă anomalia continuă, poate apărea o avertizare nouă.`)
      soc.reimprospateaza()
    } catch (e) {
      setEroare(e instanceof Error ? e.message : 'Avertizarea nu a putut fi rezolvată.')
    } finally {
      setInLucru(null)
    }
  }

  return (
    <section className="pagina" aria-labelledby="titlu-camere">

      <FluxCamera identificator={CAMERA_CU_FLUX} deschis={fluxDeschis} onSchimba={setFluxDeschis} />

      {!soc.conectat && !soc.seIncarca ? (
        <MesajSocIndisponibil eroare={soc.eroare} />
      ) : (
        <Card titlu={`Camere (${camere.length})`}>
          {mesaj && <p role="status">{mesaj}</p>}
          {eroare && <p role="alert">{eroare}</p>}
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
                    <th scope="col">Stare imagine</th>
                    <th scope="col">Alerte deschise</th>
                    <th scope="col">Ultima activitate</th>
                    <th scope="col">Acțiuni</th>
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
                      <td>{stareImagine(camera.video)}</td>
                      <td>{camera.open_alerts}</td>
                      <td>{formateazaDataOra(camera.last_seen)}</td>
                      <td>
                        {(camera.standalone_alerts ?? 0) > 0 ? (
                          <button type="button" className="buton-actiune buton-actiune--secundar"
                            disabled={inLucru !== null || !soc.conectat}
                            title="Închide alertele acestei camere care nu sunt asociate unui incident"
                            onClick={(e) => { e.stopPropagation(); void rezolva(camera.device_id) }}>
                            {inLucru === camera.device_id ? 'Se rezolvă...' : 'Rezolvă avertizarea'}
                          </button>
                        ) : camera.open_alerts > 0 ? <span className="tabel__secundar">Se gestionează din Incidente</span> : '—'}
                      </td>
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
