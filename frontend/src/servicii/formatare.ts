import type {
  SeveritateSoc,
  StareIncident,
  StareOperationalaSoc,
  StareSecuritateSoc,
} from '../tipuri/soc'

/** Clasele vizuale comune pentru indicatorii de stare. */
export type ClasaStare = 'buna' | 'atentie' | 'alerta' | 'neutra'

export type StareAfisata = {
  eticheta: string
  clasa: ClasaStare
}

export const SEVERITATI_SOC: Record<SeveritateSoc, StareAfisata> = {
  low: { eticheta: 'Scăzută', clasa: 'neutra' },
  medium: { eticheta: 'Medie', clasa: 'atentie' },
  high: { eticheta: 'Ridicată', clasa: 'alerta' },
  critical: { eticheta: 'Critică', clasa: 'alerta' },
}

export const ORDINE_SEVERITATI: SeveritateSoc[] = ['critical', 'high', 'medium', 'low']

export const STARI_INCIDENT: Record<StareIncident, StareAfisata> = {
  new: { eticheta: 'Nou', clasa: 'alerta' },
  investigating: { eticheta: 'În investigare', clasa: 'atentie' },
  contained: { eticheta: 'Izolat', clasa: 'buna' },
  resolved: { eticheta: 'Rezolvat', clasa: 'neutra' },
}

export const ORDINE_STARI_INCIDENT: StareIncident[] = [
  'new',
  'investigating',
  'contained',
  'resolved',
]

export const STARI_OPERATIONALE: Record<StareOperationalaSoc, StareAfisata> = {
  online: { eticheta: 'Online', clasa: 'buna' },
  offline: { eticheta: 'Offline', clasa: 'alerta' },
  isolated: { eticheta: 'Izolat', clasa: 'neutra' },
}

export const STARI_SECURITATE_SOC: Record<StareSecuritateSoc, StareAfisata> = {
  normal: { eticheta: 'Normală', clasa: 'buna' },
  warning: { eticheta: 'Avertizare', clasa: 'atentie' },
  compromised: { eticheta: 'Compromis', clasa: 'alerta' },
  unknown: { eticheta: 'Necunoscută', clasa: 'neutra' },
}

export const ETICHETE_ZONE: Record<string, string> = {
  terminal: 'Terminal',
  airside: 'Zona de îmbarcare (airside)',
  perimeter: 'Perimetru',
  operations: 'Operațiuni',
}

export const ETICHETE_TIP_DISPOZITIV: Record<string, string> = {
  camera: 'Cameră',
  nvr: 'NVR',
  access_control: 'Control acces',
  iot_gateway: 'Gateway IoT',
  vpn_gateway: 'Gateway VPN',
}

/** Returnează o stare afișabilă, cu o variantă neutră pentru valori necunoscute. */
export function stareSau<T extends string>(
  harta: Record<T, StareAfisata>,
  valoare: string,
): StareAfisata {
  return harta[valoare as T] ?? { eticheta: valoare, clasa: 'neutra' }
}

const FORMATATOR_DATA_ORA = new Intl.DateTimeFormat('ro-RO', {
  dateStyle: 'medium',
  timeStyle: 'medium',
  timeZone: 'Europe/Bucharest',
})

const FORMATATOR_ORA = new Intl.DateTimeFormat('ro-RO', {
  timeStyle: 'medium',
  timeZone: 'Europe/Bucharest',
})

export function formateazaDataOra(valoare: string | null | undefined): string {
  if (!valoare) {
    return '—'
  }
  const data = new Date(valoare)
  return Number.isNaN(data.getTime()) ? valoare : FORMATATOR_DATA_ORA.format(data)
}

export function formateazaOra(valoare: string | Date | null | undefined): string {
  if (!valoare) {
    return '—'
  }
  const data = valoare instanceof Date ? valoare : new Date(valoare)
  return Number.isNaN(data.getTime()) ? String(valoare) : FORMATATOR_ORA.format(data)
}

export function formateazaNumarIntreg(valoare: number | null | undefined): string {
  return (valoare ?? 0).toLocaleString('ro-RO')
}
