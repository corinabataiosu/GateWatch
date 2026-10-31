import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { RaportSoc } from '../tipuri/soc'
import {
  ORDINE_SEVERITATI,
  SEVERITATI_SOC,
  STARI_INCIDENT,
  STARI_OPERATIONALE,
  STARI_SECURITATE_SOC,
  formateazaDataOra,
  stareSau,
} from './formatare'

type DocumentPdf = jsPDF & { lastAutoTable?: { finalY: number } }

const MARGINE = 14
const CULOARE_TEXT: [number, number, number] = [28, 39, 51]
const CULOARE_SECUNDARA: [number, number, number] = [91, 104, 120]
const CULOARE_ANTET_TABEL: [number, number, number] = [235, 240, 246]

const ETICHETE_ACTIUNI: Record<string, string> = {
  isolate_device: 'izolare dispozitiv',
  release_device: 'anulare izolare',
  status_change: 'schimbare stare',
}

/** Fonturile standard jsPDF nu au ă/â/î/ș/ț; se elimină diacriticele, iar restul simbolurilor non-ASCII se înlocuiesc sau se omit. */
function text(valoare: string | number | null | undefined): string {
  return String(valoare ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[–—·]/g, '-')
    .replace(/→/g, '->')
    .replace(/[^\x20-\x7e\n]/g, '')
}

function data(valoare: string | null | undefined): string {
  return text(formateazaDataOra(valoare))
}

/** Construiește PDF-ul raportului de activitate, cu aceleași secțiuni ca raportul din aplicație. */
export function genereazaPdfRaport(raport: RaportSoc): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' }) as DocumentPdf
  const latime = doc.internal.pageSize.getWidth()
  const inaltime = doc.internal.pageSize.getHeight()
  const latimeText = latime - 2 * MARGINE
  let y = 18

  const asiguraSpatiu = (necesar: number) => {
    if (y + necesar > inaltime - 16) {
      doc.addPage()
      y = 18
    }
  }

  const paragraf = (continut: string, marime = 9.5, culoare = CULOARE_TEXT, stil = 'normal') => {
    doc.setFont('helvetica', stil)
    doc.setFontSize(marime)
    doc.setTextColor(...culoare)
    const linii = doc.splitTextToSize(text(continut), latimeText) as string[]
    const pas = marime * 0.45
    asiguraSpatiu(linii.length * pas)
    doc.text(linii, MARGINE, y)
    y += linii.length * pas + 1.5
  }

  const titluSectiune = (titlu: string) => {
    asiguraSpatiu(14)
    y += 4
    paragraf(titlu, 12.5, CULOARE_TEXT, 'bold')
    doc.setDrawColor(215, 222, 230)
    doc.line(MARGINE, y - 1, latime - MARGINE, y - 1)
    y += 2
  }

  const tabel = (antet: string[], randuri: (string | number)[][]) => {
    autoTable(doc, {
      startY: y,
      head: [antet.map(text)],
      body: randuri.map((rand) => rand.map(text)),
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 1.8, textColor: CULOARE_TEXT, lineColor: [225, 231, 238] },
      headStyles: { fillColor: CULOARE_ANTET_TABEL, textColor: CULOARE_TEXT, fontStyle: 'bold' },
      margin: { left: MARGINE, right: MARGINE, bottom: 16 },
    })
    y = (doc.lastAutoTable?.finalY ?? y) + 5
  }

  const t = raport.totals

  paragraf('GateWatch - raport de activitate SOC', 17, CULOARE_TEXT, 'bold')
  paragraf(
    `Generat ${data(raport.generated_at)}  |  evenimente intre ${data(raport.period.first_event)} si ${data(raport.period.last_event)}`,
    8.5,
    CULOARE_SECUNDARA,
  )

  titluSectiune('Rezumat')
  paragraf(raport.summary)
  y += 1
  tabel(
    ['Evenimente', 'Alerte (deschise)', 'Incidente (deschise)', 'Dispozitive la risc'],
    [[t.events, `${t.alerts} (${t.alerts_open})`, `${t.incidents} (${t.incidents_open})`, t.devices_at_risk]],
  )
  paragraf(
    'Alerte dupa severitate: ' +
      ORDINE_SEVERITATI.map((s) => `${SEVERITATI_SOC[s].eticheta} ${raport.severity_counts[s] ?? 0}`).join(', ') +
      `  |  surse: ${t.alerts_rule} din reguli, ${t.alerts_ml} din modele ML`,
    8.5,
    CULOARE_SECUNDARA,
  )

  titluSectiune('Incidente')
  if (raport.incidents.length === 0) {
    paragraf('Nu au fost corelate incidente.')
  }
  for (const incident of raport.incidents) {
    asiguraSpatiu(30)
    paragraf(`${incident.incident_id} - ${incident.title}`, 10.5, CULOARE_TEXT, 'bold')
    paragraf(
      `Severitate ${SEVERITATI_SOC[incident.severity].eticheta}  |  stare ${stareSau(STARI_INCIDENT, incident.status).eticheta}` +
        `  |  creat ${data(incident.created_at)}  |  ultima alerta ${data(incident.last_alert_at)}`,
      8.5,
      CULOARE_SECUNDARA,
    )
    paragraf(incident.summary, 9)
    paragraf(
      `Dispozitive: ${incident.devices.join(', ')}  |  Tactici: ${incident.tactics.join(', ') || '-'}`,
      8.5,
      CULOARE_SECUNDARA,
    )
    tabel(
      ['Ora', 'Regula', 'Severitate', 'Dispozitiv', 'Alerta', 'MITRE'],
      incident.alerts.map((a) => [
        data(a.created_at),
        a.rule_id,
        SEVERITATI_SOC[a.severity].eticheta,
        a.device_id,
        `${a.title}\n${a.description}`,
        a.technique_id ?? '-',
      ]),
    )
    if (incident.actions.length > 0) {
      paragraf('Actiuni de raspuns', 9, CULOARE_TEXT, 'bold')
      for (const actiune of incident.actions) {
        paragraf(
          `- ${data(actiune.created_at)}  ${ETICHETE_ACTIUNI[actiune.action] ?? actiune.action}` +
            `${actiune.device_id ? ` ${actiune.device_id}` : ''}: ${actiune.detail ?? actiune.result}`,
          8.5,
        )
      }
      y += 2
    }
  }

  titluSectiune('Dispozitive la risc')
  if (raport.devices_at_risk.length === 0) {
    paragraf('Niciun dispozitiv la risc.')
  } else {
    tabel(
      ['Dispozitiv', 'Nume', 'Zona', 'Stare securitate', 'Stare operationala', 'Alerte deschise'],
      raport.devices_at_risk.map((d) => [
        d.device_id,
        d.name ?? '',
        d.zone ?? '',
        STARI_SECURITATE_SOC[d.security_state].eticheta,
        stareSau(STARI_OPERATIONALE, d.operational_status).eticheta,
        d.open_alerts,
      ]),
    )
  }

  if (raport.alerts_by_rule.length > 0) {
    titluSectiune('Alerte pe regula de detectie')
    tabel(
      ['Regula', 'Descriere', 'Alerte'],
      raport.alerts_by_rule.map((r) => [r.rule_id, r.name, r.count]),
    )
  }

  if (raport.techniques.length > 0) {
    titluSectiune('Tehnici MITRE ATT&CK observate')
    tabel(
      ['Tehnica', 'Denumire', 'Tactica', 'Alerte'],
      raport.techniques.map((x) => [x.technique_id, x.technique ?? '', x.tactic ?? '', x.count]),
    )
  }

  const pagini = doc.getNumberOfPages()
  for (let pagina = 1; pagina <= pagini; pagina += 1) {
    doc.setPage(pagina)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...CULOARE_SECUNDARA)
    doc.text(`GateWatch SOC - raport generat ${data(raport.generated_at)}`, MARGINE, inaltime - 8)
    doc.text(`Pagina ${pagina} / ${pagini}`, latime - MARGINE, inaltime - 8, { align: 'right' })
  }

  return doc
}

export function descarcaPdfRaport(raport: RaportSoc): void {
  const marca = raport.generated_at.slice(0, 19).replace(/[:T]/g, '-')
  genereazaPdfRaport(raport).save(`gatewatch-raport-${marca}.pdf`)
}
