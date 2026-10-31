import { useCallback, useEffect, useRef, useState } from 'react'
import {
  obtineAlerte,
  obtineDispozitive,
  obtineIncidente,
  obtinePrezentareGenerala,
  obtineSanatate,
} from '../servicii/clientSoc'
import type {
  AlertaSoc,
  DispozitivSoc,
  IncidentSoc,
  PrezentareGeneralaSoc,
  StareSanatateSoc,
} from '../tipuri/soc'

const INTERVAL_ACTUALIZARE_MS = 3000

export type DateSoc = {
  /** Adevărat după primul răspuns reușit și cât timp SOC răspunde. */
  conectat: boolean
  /** Adevărat până la finalizarea primei încercări de conectare. */
  seIncarca: boolean
  eroare: string | null
  ultimaActualizare: Date | null
  sanatate: StareSanatateSoc | null
  prezentare: PrezentareGeneralaSoc | null
  dispozitive: DispozitivSoc[]
  alerte: AlertaSoc[]
  incidente: IncidentSoc[]
  /** Forțează o actualizare imediată (de ex. după o acțiune a operatorului). */
  reimprospateaza: () => void
}

/**
 * Interoghează periodic backend-ul SOC.
 * Când SOC nu este accesibil, păstrează ultimele date primite și marchează conexiunea ca întreruptă.
 */
export function useDateSoc(): DateSoc {
  const [stare, setStare] = useState<Omit<DateSoc, 'reimprospateaza'>>({
    conectat: false,
    seIncarca: true,
    eroare: null,
    ultimaActualizare: null,
    sanatate: null,
    prezentare: null,
    dispozitive: [],
    alerte: [],
    incidente: [],
  })
  const cerereInCurs = useRef(false)

  const actualizeaza = useCallback(async () => {
    if (cerereInCurs.current) {
      return
    }
    cerereInCurs.current = true

    try {
      const [sanatate, prezentare, dispozitive, alerte, incidente] = await Promise.all([
        obtineSanatate(),
        obtinePrezentareGenerala(),
        obtineDispozitive(),
        obtineAlerte({ limita: 500 }),
        obtineIncidente(),
      ])
      setStare({
        conectat: true,
        seIncarca: false,
        eroare: null,
        ultimaActualizare: new Date(),
        sanatate,
        prezentare,
        dispozitive,
        alerte,
        incidente,
      })
    } catch (eroare) {
      setStare((anterior) => ({
        ...anterior,
        conectat: false,
        seIncarca: false,
        eroare: eroare instanceof Error ? eroare.message : 'Eroare necunoscută.',
      }))
    } finally {
      cerereInCurs.current = false
    }
  }, [])

  useEffect(() => {
    const pornire = setTimeout(() => void actualizeaza(), 0)
    const interval = setInterval(() => void actualizeaza(), INTERVAL_ACTUALIZARE_MS)
    return () => {
      clearTimeout(pornire)
      clearInterval(interval)
    }
  }, [actualizeaza])

  const reimprospateaza = useCallback(() => {
    void actualizeaza()
  }, [actualizeaza])

  return { ...stare, reimprospateaza }
}
