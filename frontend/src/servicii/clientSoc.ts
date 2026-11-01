import type {
  ActiuneIncident,
  AlertaSoc,
  DetaliiIncidentSoc,
  DispozitivSoc,
  EvenimentSoc,
  IncidentSoc,
  PrezentareGeneralaSoc,
  RaportSoc,
  StareIncident,
  StareSanatateSoc,
} from '../tipuri/soc'

/** Adresa de bază a API-ului SOC; în dezvoltare, Vite redirecționează /api către portul 8000. */
const ADRESA_BAZA = import.meta.env.VITE_SOC_API_URL ?? ''

const TIMP_MAXIM_CERERE_MS = 5000

/** Demo token only; deployments can configure their own token explicitly. */
export function anteteAdmin(): Record<string, string> {
  const token = localStorage.getItem('gatewatch-admin-token')
    ?? import.meta.env.VITE_ADMIN_TOKEN
    ?? (import.meta.env.DEV ? 'gatewatch-admin' : '')
  return { 'X-Admin-Token': token }
}

/** Eroare apărută la comunicarea cu backend-ul SOC. */
export class EroareSoc extends Error {
  readonly codStare: number | null

  constructor(mesaj: string, codStare: number | null = null) {
    super(mesaj)
    this.name = 'EroareSoc'
    this.codStare = codStare
  }
}

async function cerere<T>(cale: string, optiuni: RequestInit = {}, timeout = TIMP_MAXIM_CERERE_MS): Promise<T> {
  const controler = new AbortController()
  const temporizator = setTimeout(() => controler.abort(), timeout)

  try {
    const raspuns = await fetch(`${ADRESA_BAZA}${cale}`, {
      ...optiuni,
      headers: { 'Content-Type': 'application/json',
        ...(optiuni.method && optiuni.method !== 'GET' ? anteteAdmin() : {}), ...optiuni.headers },
      signal: controler.signal,
    })

    if (!raspuns.ok) {
      let detaliu = raspuns.statusText
      try {
        const corp = (await raspuns.json()) as { detail?: unknown }
        if (typeof corp.detail === 'string') {
          detaliu = corp.detail
        }
      } catch {
        // Corpul răspunsului nu este JSON; se păstrează textul de stare.
      }
      throw new EroareSoc(`SOC a răspuns cu ${raspuns.status}: ${detaliu}`, raspuns.status)
    }

    return (await raspuns.json()) as T
  } catch (eroare) {
    if (eroare instanceof EroareSoc) {
      throw eroare
    }
    if (eroare instanceof DOMException && eroare.name === 'AbortError') {
      throw new EroareSoc('Backend-ul SOC nu a răspuns în timp util.')
    }
    throw new EroareSoc('Backend-ul SOC nu este accesibil.')
  } finally {
    clearTimeout(temporizator)
  }
}

function construiesteInterogare(parametri: Record<string, string | number | undefined>): string {
  const interogare = new URLSearchParams()
  for (const [cheie, valoare] of Object.entries(parametri)) {
    if (valoare !== undefined && valoare !== '') {
      interogare.set(cheie, String(valoare))
    }
  }
  const text = interogare.toString()
  return text ? `?${text}` : ''
}

export function obtineSanatate(): Promise<StareSanatateSoc> {
  return cerere('/api/health')
}

export function obtinePrezentareGenerala(): Promise<PrezentareGeneralaSoc> {
  return cerere('/api/overview')
}

export function obtineDispozitive(): Promise<DispozitivSoc[]> {
  return cerere('/api/devices')
}

export function obtineEvenimente(
  filtru: { deviceId?: string; limita?: number } = {},
): Promise<EvenimentSoc[]> {
  return cerere(
    `/api/events${construiesteInterogare({ device_id: filtru.deviceId, limit: filtru.limita })}`,
  )
}

export function obtineAlerte(
  filtru: { stare?: string; limita?: number } = {},
): Promise<AlertaSoc[]> {
  return cerere(
    `/api/alerts${construiesteInterogare({ status: filtru.stare, limit: filtru.limita })}`,
  )
}

export function obtineIncidente(): Promise<IncidentSoc[]> {
  return cerere('/api/incidents')
}

export function obtineDetaliiIncident(id: string): Promise<DetaliiIncidentSoc> {
  return cerere(`/api/incidents/${encodeURIComponent(id)}`)
}

export function actualizeazaStareIncident(
  id: string,
  stare: StareIncident,
): Promise<IncidentSoc> {
  return cerere(`/api/incidents/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: stare }),
  })
}

export function izoleazaDispozitiv(
  idIncident: string,
  idDispozitiv: string,
): Promise<ActiuneIncident> {
  return cerere(`/api/incidents/${encodeURIComponent(idIncident)}/actions`, {
    method: 'POST',
    body: JSON.stringify({ action: 'isolate_device', device_id: idDispozitiv }),
  })
}

/** Generează raportul de activitate pe baza datelor curente ale SOC. */
export function genereazaRaport(): Promise<RaportSoc> {
  return cerere<RaportSoc>('/api/report')
}

export function reseteazaSoc(): Promise<unknown> {
  return cerere('/api/reset', { method: 'POST' })
}

export function restabilesteDispozitiv(id: string, requestId: string): Promise<{closed_alerts: number}> {
  return cerere(`/api/devices/${encodeURIComponent(id)}/restore`, {
    method: 'POST', body: JSON.stringify({ request_id: requestId }),
  }, 20000)
}
