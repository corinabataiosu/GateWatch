import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"
import type { RaportSalvat } from "../tipuri/raport"

interface DocCuAutoTable extends jsPDF {
  lastAutoTable?: { finalY: number }
}

function curataTextPdf(text: string | undefined | null): string {
  if (!text) return ""
  return text
    .replace(/ă/g, "a")
    .replace(/Ă/g, "A")
    .replace(/â/g, "a")
    .replace(/Â/g, "A")
    .replace(/î/g, "i")
    .replace(/Î/g, "I")
    .replace(/ș/g, "s")
    .replace(/Ș/g, "S")
    .replace(/ş/g, "s")
    .replace(/Ş/g, "S")
    .replace(/ț/g, "t")
    .replace(/Ț/g, "T")
    .replace(/ţ/g, "t")
    .replace(/Ţ/g, "T")
}

export function genereazaDocumentPdf(raport: RaportSalvat): jsPDF {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  }) as DocCuAutoTable

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

  // Header GateWatch: Deep Navy Blue (#0f172a)
  doc.setFillColor(15, 23, 42)
  doc.rect(0, 0, pageWidth, 28, "F")

  // Accent Line Albastra (#1d4ed8)
  doc.setFillColor(29, 78, 216)
  doc.rect(0, 28, pageWidth, 2, "F")

  // Text antet
  doc.setTextColor(255, 255, 255)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(14)
  doc.text("GATEWATCH SOC  |  RAPORT DE OPERATIUNI SI SECURITATE", 14, 13)

  doc.setFont("helvetica", "normal")
  doc.setFontSize(9)
  doc.setTextColor(203, 213, 225)
  doc.text("Sistem Centralizat de Monitorizare Aeroportuara", 14, 20)

  doc.setFont("helvetica", "bold")
  doc.setFontSize(9)
  doc.setTextColor(147, 197, 253)
  doc.text("CONFIDENTIAL", pageWidth - 14, 13, { align: "right" })

  doc.setFont("helvetica", "normal")
  doc.setFontSize(8)
  doc.setTextColor(203, 213, 225)
  doc.text("ID: " + curataTextPdf(raport.id), pageWidth - 14, 20, { align: "right" })

  let currentY = 38

  // Titlu Raport
  doc.setTextColor(15, 23, 42)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(14)
  doc.text(curataTextPdf(raport.titlu), 14, currentY)
  currentY += 7

  // Metadate
  doc.setFont("helvetica", "normal")
  doc.setFontSize(9)
  doc.setTextColor(81, 96, 122)
  const perioadaText = "Perioada analizata: " + curataTextPdf(raport.perioadaInceput) + " - " + curataTextPdf(raport.perioadaSfarsit)
  doc.text(perioadaText, 14, currentY)

  const metaDreapta = "Generat la: " + curataTextPdf(raport.generatLa) + "  |  Operator: " + curataTextPdf(raport.generatDe)
  doc.text(metaDreapta, pageWidth - 14, currentY, { align: "right" })
  currentY += 10

  // Bloc Rezumat Executiv
  doc.setFillColor(248, 250, 252)
  doc.setDrawColor(226, 232, 240)
  doc.roundedRect(14, currentY, pageWidth - 28, 22, 2, 2, "FD")

  doc.setFont("helvetica", "bold")
  doc.setFontSize(9)
  doc.setTextColor(30, 58, 138)
  doc.text("REZUMAT EXECUTIV", 18, currentY + 6)

  doc.setFont("helvetica", "normal")
  doc.setFontSize(8.5)
  doc.setTextColor(51, 65, 85)
  const sumarLinii = doc.splitTextToSize(curataTextPdf(raport.sumar), pageWidth - 36)
  doc.text(sumarLinii, 18, currentY + 12)

  currentY += 28

  // Indicatori Cheie
  if (raport.statistici && raport.statistici.length > 0) {
    const boxCount = Math.min(raport.statistici.length, 4)
    const gap = 4
    const totalGap = gap * (boxCount - 1)
    const boxWidth = (pageWidth - 28 - totalGap) / boxCount

    raport.statistici.slice(0, boxCount).forEach((stat, index) => {
      const boxX = 14 + index * (boxWidth + gap)
      doc.setFillColor(255, 255, 255)
      doc.setDrawColor(226, 232, 240)
      doc.roundedRect(boxX, currentY, boxWidth, 16, 1.5, 1.5, "FD")

      doc.setFillColor(29, 78, 216)
      doc.rect(boxX, currentY, boxWidth, 1.2, "F")

      doc.setFont("helvetica", "normal")
      doc.setFontSize(7.5)
      doc.setTextColor(81, 96, 122)
      doc.text(curataTextPdf(stat.eticheta), boxX + 4, currentY + 6.5)

      doc.setFont("helvetica", "bold")
      doc.setFontSize(11)
      doc.setTextColor(15, 23, 42)
      doc.text(curataTextPdf(String(stat.valoare)), boxX + 4, currentY + 13)
    })

    currentY += 22
  }

  // Tabel Detalii autoTable
  const tableData = raport.elemente.map((el) => [
    curataTextPdf(el.id),
    curataTextPdf(el.data),
    curataTextPdf(el.titlu),
    curataTextPdf(el.severitate || el.stare || "-"),
    curataTextPdf(el.dispozitiv || "-"),
    curataTextPdf(el.detalii),
  ])

  autoTable(doc, {
    startY: currentY,
    head: [["ID / Cod", "Data & Ora", "Eveniment / Titlu", "Severitate / Stare", "Dispozitiv", "Detalii"]],
    body: tableData,
    theme: "grid",
    headStyles: {
      fillColor: [30, 58, 138],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8,
      cellPadding: 2.5,
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [15, 23, 42],
      cellPadding: 2.5,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 22, fontStyle: "bold" },
      1: { cellWidth: 26 },
      2: { cellWidth: 40 },
      3: { cellWidth: 24 },
      4: { cellWidth: 22 },
      5: { cellWidth: "auto" },
    },
    margin: { left: 14, right: 14 },
    didDrawPage: () => {
      const pageNumber = doc.getNumberOfPages()
      doc.setFont("helvetica", "normal")
      doc.setFontSize(7.5)
      doc.setTextColor(115, 128, 153)
      doc.text(
        "GateWatch SOC  |  Document generat automat  |  Pagina " + pageNumber,
        14,
        pageHeight - 8
      )
      doc.text(
        "CONFIDENTIAL - Destinat personalului autorizat de securitate aeroportuara",
        pageWidth - 14,
        pageHeight - 8,
        { align: "right" }
      )
    },
  })

  // Recomandari
  const finalY = doc.lastAutoTable?.finalY ?? currentY + 50
  if (raport.recomandari && raport.recomandari.length > 0) {
    let recY = finalY + 8
    if (recY + 30 > pageHeight - 15) {
      doc.addPage()
      recY = 20
    }

    doc.setFont("helvetica", "bold")
    doc.setFontSize(9)
    doc.setTextColor(30, 58, 138)
    doc.text("MASURI SI RECOMANDARI SOC:", 14, recY)
    recY += 5

    doc.setFont("helvetica", "normal")
    doc.setFontSize(8)
    doc.setTextColor(51, 65, 85)
    raport.recomandari.forEach((rec) => {
      const recLinii = doc.splitTextToSize("- " + curataTextPdf(rec), pageWidth - 28)
      doc.text(recLinii, 14, recY)
      recY += recLinii.length * 4
    })
  }

  return doc
}

export function descarcaPdfRaport(raport: RaportSalvat): void {
  const doc = genereazaDocumentPdf(raport)
  const safeTitle = raport.titlu
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "_")
    .slice(0, 40)
  const dataGenerare = raport.generatLa.replace(/[: ]/g, "-").slice(0, 16)
  doc.save(safeTitle + "_" + dataGenerare + ".pdf")
}
