import type { RaportSoc } from '../tipuri/soc'

/**
 * Istoricul local al rapoartelor generate de SOC (GET /api/report).
 * Fiecare raport este păstrat exact cum a venit de la backend, ca să poată fi revăzut
 * sau exportat și după ce SOC a fost resetat ori oprit.
 */
const CHEIE_STORAGE = 'gatewatch_rapoarte_soc'
const NUMAR_MAXIM_RAPOARTE = 20

export function incarcaRapoarte(): RaportSoc[] {
  try {
    const salvate = JSON.parse(localStorage.getItem(CHEIE_STORAGE) ?? '[]') as unknown
    return Array.isArray(salvate) ? (salvate as RaportSoc[]) : []
  } catch {
    return []
  }
}

function scrie(rapoarte: RaportSoc[]): RaportSoc[] {
  try {
    localStorage.setItem(CHEIE_STORAGE, JSON.stringify(rapoarte))
  } catch (eroare) {
    console.error('Istoricul rapoartelor nu a putut fi salvat:', eroare)
  }
  return rapoarte
}

/** Adaugă raportul la începutul istoricului; raportul este identificat prin `generated_at`. */
export function salveazaRaport(raport: RaportSoc): RaportSoc[] {
  const altele = incarcaRapoarte().filter((r) => r.generated_at !== raport.generated_at)
  return scrie([raport, ...altele].slice(0, NUMAR_MAXIM_RAPOARTE))
}

export function stergeRaport(generatLa: string): RaportSoc[] {
  return scrie(incarcaRapoarte().filter((r) => r.generated_at !== generatLa))
}
