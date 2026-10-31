/**
 * Tipuri pentru răspunsurile API-ului SOC GateWatch (port 8000).
 * Numele câmpurilor urmează exact contractul din docs/contracts.md §5.
 */

export type SeveritateSoc = 'low' | 'medium' | 'high' | 'critical'

export type StareSecuritateSoc = 'normal' | 'warning' | 'compromised' | 'unknown'

export type StareOperationalaSoc = 'online' | 'offline' | 'isolated'

export type StareIncident = 'new' | 'investigating' | 'contained' | 'resolved'

export type SursaAlertaSoc = 'rule' | 'ml'

export type StareAlertaSoc = 'open' | 'closed'

export type StareIngestie = {
  connected: boolean
  run_id: string | null
  last_seq: number
  events_ingested: number
  last_poll_at: string | null
  error: string | null
}

export type StareSanatateSoc = {
  status: string
  ingestion: StareIngestie
  model: { loaded: boolean; version: string | null }
}

export type PrezentareGeneralaSoc = {
  events_total: number
  alerts_open: number
  incidents_open: number
  devices: { total: number; at_risk: number }
  severity_counts: Partial<Record<SeveritateSoc, number>>
}

export type DispozitivSoc = {
  device_id: string
  type: string
  zone: string
  ip: string
  name: string
  operational_status: StareOperationalaSoc
  security_state: StareSecuritateSoc
  open_alerts: number
  last_seen: string | null
  /** Ultimul scor Isolation Forest calculat de SOC pe evenimentele dispozitivului. */
  ml: ScorMlSoc | null
  /** Ultima telemetrie a modulului video (ml/src/agent_video.py), dacă rulează pentru dispozitiv. */
  video: TelemetrieVideoSoc | null
}

export type TelemetrieVideoSoc = {
  captured_at: string
  /** Luminozitate medie, 0-255. */
  brightness: number
  /** Varianța Laplacianului (fără limită superioară). */
  sharpness: number
  /** Diferența medie față de cadrul anterior, 0-255. */
  frame_diff: number | null
  score: number
  threshold: number
  is_anomaly: boolean
  out_of_range: string[]
  model_version: string | null
  source: 'camera' | 'synthetic'
  stale: boolean
  diagnosis: string | null
}

export type ScorMlSoc = {
  score: number
  threshold: number
  is_anomaly: boolean
  evaluated_at: string
  top_features: string[]
}

export type EvenimentSoc = {
  event_id: string
  run_id: string
  seq: number
  occurred_at: string
  device_id: string
  event_type: string
  outcome: 'success' | 'failure' | 'info'
  origin: 'synthetic' | 'scenario_generated' | 'observed_http'
  source: { ip: string; user: string | null; zone: string | null }
  target: { ip: string; port: number | null; service: string }
  details: Record<string, unknown>
}

export type TehnicaMitre = {
  technique_id: string
  technique: string
  tactic: string
}

export type AlertaSoc = {
  alert_id: string
  created_at: string
  rule_id: string
  source: SursaAlertaSoc
  severity: SeveritateSoc
  device_id: string
  title: string
  description: string
  mitre: TehnicaMitre | null
  event_ids: string[]
  incident_id: string | null
  status: StareAlertaSoc
  score?: number | null
}

export type IncidentSoc = {
  incident_id: string
  title: string
  status: StareIncident
  severity: SeveritateSoc
  created_at: string
  updated_at: string
  devices: string[]
  alert_count: number
  tactics: string[]
  summary: string
}

export type ActiuneIncident = {
  action: string
  device_id?: string
  performed_at?: string
  result?: string
  [cheie: string]: unknown
}

export type DetaliiIncidentSoc = IncidentSoc & {
  alerts: AlertaSoc[]
  timeline: EvenimentSoc[]
  actions: ActiuneIncident[]
}

/** Raportul de activitate generat de SOC (GET /api/report). */
export type RaportSoc = {
  generated_at: string
  period: { first_event: string | null; last_event: string | null }
  summary: string
  totals: {
    events: number
    alerts: number
    alerts_open: number
    alerts_rule: number
    alerts_ml: number
    incidents: number
    incidents_open: number
    devices_at_risk: number
  }
  severity_counts: Record<SeveritateSoc, number>
  incidents_by_status: Record<StareIncident, number>
  alerts_by_rule: { rule_id: string; name: string; count: number }[]
  techniques: { technique_id: string; technique?: string; tactic?: string; count: number }[]
  incidents: IncidentRaport[]
  devices_at_risk: {
    device_id: string
    name: string | null
    zone: string | null
    security_state: StareSecuritateSoc
    operational_status: StareOperationalaSoc
    open_alerts: number
  }[]
}

export type IncidentRaport = {
  incident_id: string
  title: string
  status: StareIncident
  severity: SeveritateSoc
  created_at: string
  last_alert_at: string
  devices: string[]
  tactics: string[]
  summary: string
  alerts: {
    alert_id: string
    created_at: string
    rule_id: string
    severity: SeveritateSoc
    device_id: string
    title: string
    description: string
    technique_id: string | null
  }[]
  actions: {
    created_at: string
    action: string
    device_id: string | null
    result: string
    detail: string | null
  }[]
}
