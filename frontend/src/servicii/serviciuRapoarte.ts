import type {
  CategorieRaport,
  ParametriGenerareRaport,
  RaportSalvat,
} from "../tipuri/raport"

export const CATEGORII_RAPORT: CategorieRaport[] = [
  {
    id: "utilizatori",
    titlu: "Autentificare & Utilizatori",
    subtitlu: "Audit incercari de autentificare, scanari insigne si permisiuni",
    icon: "utilizatori",
  },
  {
    id: "incidente",
    titlu: "Incidente",
    subtitlu: "Incidente corelate, severitati, stare investigatie si raspuns",
    icon: "incidente",
  },
  {
    id: "dispozitive",
    titlu: "Dispozitive & Camere",
    subtitlu: "Stare camere video, servere, porti de acces si dispozitive",
    icon: "dispozitive",
  },
  {
    id: "alerte",
    titlu: "Alerte Securitate",
    subtitlu: "Evenimente suspecte semnalate prin reguli SIEM si corelare",
    icon: "alerte",
  },
  {
    id: "retea",
    titlu: "Trafic Retea",
    subtitlu: "Fluxuri de date, porturi anormale, exfiltrare si conexiuni",
    icon: "retea",
  },
  {
    id: "ml",
    titlu: "Detectii ML",
    subtitlu: "Anomalii de comportament detectate prin Isolation Forest si video",
    icon: "ml",
  },
  {
    id: "audit",
    titlu: "Audit General SOC",
    subtitlu: "Sinteza completa a activitatii operationale a aeroportului",
    icon: "audit",
  },
]

const CHEIE_STORAGE_RAPOARTE = "gatewatch_rapoarte_salvate"

const RAPOARTE_IMPLICITE: RaportSalvat[] = [
  {
    id: "rap-101",
    titlu: "Raport Autentificare & Utilizatori - 31.05.2026 20:45",
    categorie: "utilizatori",
    numeCategorie: "Autentificare & Utilizatori",
    generatLa: "31.05.2026 20:45",
    generatDe: "Petrescu Razvan",
    perioadaInceput: "2026-05-01 00:00",
    perioadaSfarsit: "2026-05-31 20:45",
    sumar:
      "Analiza accesului utilizatorilor si a incercarilor de autentificare pe portile terminalului aeroportuar si statiile de control SOC. Au fost inregistrate 3 tentative esuate de acces pe conturi administrative.",
    statistici: [
      { eticheta: "Utilizatori activi", valoare: 42 },
      { eticheta: "Autentificari reusite", valoare: 1284 },
      { eticheta: "Tentative esuate", valoare: 19 },
      { eticheta: "Conturi blocate temporar", valoare: 1 },
    ],
    elemente: [
      {
        id: "AUTH-892",
        titlu: "Scanare insigna valida - Poarta Control Nord",
        data: "31.05.2026 20:12",
        severitate: "Scazuta",
        stare: "Autorizat",
        dispozitiv: "GATE-N01",
        detalii: "Acces permis operator mentenanta (ID: OP-412)",
      },
      {
        id: "AUTH-891",
        titlu: "Autentificare SSH esuata repetata (Brute-Force)",
        data: "31.05.2026 19:48",
        severitate: "Ridicata",
        stare: "Blocat",
        dispozitiv: "SRV-MGMT-01",
        detalii: "IP sursa extern 192.168.1.105 blocat automat dupa 5 incercari invalide",
      },
      {
        id: "AUTH-890",
        titlu: "Autentificare consola SOC Analyst",
        data: "31.05.2026 18:00",
        severitate: "Normala",
        stare: "Autorizat",
        dispozitiv: "SOC-WS-02",
        detalii: "Sesiune valida deschisa de Petrescu Razvan",
      },
    ],
    recomandari: [
      "Mentinerea politicii de blocare automata la 5 incercari esuate consecutive.",
      "Revizuirea periodica a drepturilor de acces pentru personalul tehnic la portile pistei.",
    ],
  },
  {
    id: "rap-102",
    titlu: "Raport Detectii ML - 19.05.2026 22:39",
    categorie: "ml",
    numeCategorie: "Detectii ML",
    generatLa: "19.05.2026 22:39",
    generatDe: "Petrescu Razvan",
    perioadaInceput: "2026-05-10 00:00",
    perioadaSfarsit: "2026-05-19 22:39",
    sumar:
      "Sinteza anomaliilor identificate prin algoritmii de invatare automata Isolation Forest pentru fluxurile de telemetrie si analiza video.",
    statistici: [
      { eticheta: "Total verificari ML", valoare: 14820 },
      { eticheta: "Anomalii confirmate", valoare: 6 },
      { eticheta: "Acuratete model", valoare: "99.4%" },
      { eticheta: "Scor risc maxim", valoare: "0.88" },
    ],
    elemente: [
      {
        id: "ML-044",
        titlu: "Obturare imagine video camera perimetru (GW-V01)",
        data: "19.05.2026 21:10",
        severitate: "Critica",
        stare: "Confirmat",
        dispozitiv: "CAM-01",
        detalii: "Deviatie brusca de luminozitate si contrast identificata de modelul video",
      },
      {
        id: "ML-043",
        titlu: "Model neobisnuit de interogare API telemetrie (GW-ML01)",
        data: "18.05.2026 14:22",
        severitate: "Medie",
        stare: "Investigat",
        dispozitiv: "GW-SENSOR-03",
        detalii: "Frecventa de transmitere de 4x mai mare decat linia de baza",
      },
    ],
    recomandari: [
      "Reantrenarea periodica a modelului Isolation Forest cu noile linii de baza.",
      "Corelarea detectiilor video cu senzorii fizici de miscare din aceeasi zona.",
    ],
  },
  {
    id: "rap-103",
    titlu: "Raport Audit General SOC - 19.05.2026 22:27",
    categorie: "audit",
    numeCategorie: "Audit General SOC",
    generatLa: "19.05.2026 22:27",
    generatDe: "Petrescu Razvan",
    perioadaInceput: "2026-05-01 00:00",
    perioadaSfarsit: "2026-05-19 22:27",
    sumar:
      "Evaluare generala a posturii de securitate cibernetica a aeroportului. Toate serviciile critice sunt monitorizate continuu.",
    statistici: [
      { eticheta: "Evenimente totale", valoare: 38450 },
      { eticheta: "Alerte deschise", valoare: 5 },
      { eticheta: "Incidente inchise", valoare: 8 },
      { eticheta: "Timp mediu raspuns", valoare: "4.2 min" },
    ],
    elemente: [
      {
        id: "AUD-301",
        titlu: "Verificare conformitate reguli SIEM",
        data: "19.05.2026 12:00",
        severitate: "Normala",
        stare: "Conform",
        dispozitiv: "SOC-CORE",
        detalii: "Toate regulile de detectie sunt active si functionale",
      },
      {
        id: "AUD-300",
        titlu: "Audit permisiuni retea segmentare OT/IT",
        data: "15.05.2026 09:30",
        severitate: "Scazuta",
        stare: "Finalizat",
        dispozitiv: "FIREWALL-CORE",
        detalii: "Politicile de izolare VLAN functioneaza conform specificatiilor",
      },
    ],
    recomandari: [
      "Simularea trimestriala a procedurilor de izolare pentru dispozitivele compromise.",
      "Actualizarea semnaturilor MITRE ATT&CK in catalogul de corelare.",
    ],
  },
  {
    id: "rap-104",
    titlu: "Raport Dispozitive & Camere - 19.05.2026 16:52",
    categorie: "dispozitive",
    numeCategorie: "Dispozitive & Camere",
    generatLa: "19.05.2026 16:52",
    generatDe: "Petrescu Razvan",
    perioadaInceput: "2026-05-01 00:00",
    perioadaSfarsit: "2026-05-19 16:52",
    sumar:
      "Inventar si stare de sanatate operationala a camerelor video de supraveghere, serverelor de baze de date si portilor de securitate.",
    statistici: [
      { eticheta: "Dispozitive active", valoare: 18 },
      { eticheta: "Camere operationale", valoare: "12 / 12" },
      { eticheta: "Dispozitive izolate", valoare: 0 },
      { eticheta: "Disponibilitate", valoare: "99.98%" },
    ],
    elemente: [
      {
        id: "DEV-CAM-01",
        titlu: "Camera Supraveghere Terminal Sosiri (CAM-01)",
        data: "19.05.2026 16:50",
        severitate: "Normala",
        stare: "Activ",
        dispozitiv: "CAM-01",
        detalii: "Flux video RTSP stabil, latenta 42ms, FPS 25 constant",
      },
      {
        id: "DEV-GATE-02",
        titlu: "Poarta Imbarcare Poarta B12",
        data: "19.05.2026 16:48",
        severitate: "Normala",
        stare: "Activ",
        dispozitiv: "GATE-B12",
        detalii: "Sistem control acces operational, fara erori de conexiune",
      },
    ],
    recomandari: [
      "Verificarea periodica a firmware-ului camerelor IP din perimetrul exterior.",
      "Asigurarea surselor redundante UPS pentru echipamentele din Terminal.",
    ],
  },
  {
    id: "rap-105",
    titlu: "Raport Incidente - 19.05.2026 16:52",
    categorie: "incidente",
    numeCategorie: "Incidente",
    generatLa: "19.05.2026 16:52",
    generatDe: "Petrescu Razvan",
    perioadaInceput: "2026-05-01 00:00",
    perioadaSfarsit: "2026-05-19 16:52",
    sumar:
      "Analiza incidentelor de securitate cibernetica si fizica corelate in perioada mentionata, clasificarea dupa severitate si actiunile de raspuns aplicate.",
    statistici: [
      { eticheta: "Total incidente", valoare: 7 },
      { eticheta: "Incidente critice", valoare: 1 },
      { eticheta: "Rezolvate", valoare: 5 },
      { eticheta: "In investigare", valoare: 2 },
    ],
    elemente: [
      {
        id: "INC-2026-05-01",
        titlu: "Tentativa de bruiere flux video si miscare suspecta in hangar",
        data: "19.05.2026 16:40",
        severitate: "Critica",
        stare: "Investigare",
        dispozitiv: "CAM-01, SENS-08",
        detalii: "Echipa de interventie notificata si transmisa in teren",
      },
      {
        id: "INC-2026-05-02",
        titlu: "Scanare de porturi interna pe reteaua de bagaje",
        data: "18.05.2026 11:20",
        severitate: "Ridicata",
        stare: "Rezolvat",
        dispozitiv: "SRV-BAG-02",
        detalii: "Dispozitiv sursa izolat automat din retea prin actiune de raspuns SOC",
      },
    ],
    recomandari: [
      "Completarea jurnalului de investigatie pentru incidentul critic INC-2026-05-01.",
      "Testarea procedurii de izolare rapida pe segmentul retelei de bagaje.",
    ],
  },
]

export function incarcaRapoarteSalvate(): RaportSalvat[] {
  try {
    const salvate = localStorage.getItem(CHEIE_STORAGE_RAPOARTE)
    if (!salvate) {
      localStorage.setItem(CHEIE_STORAGE_RAPOARTE, JSON.stringify(RAPOARTE_IMPLICITE))
      return RAPOARTE_IMPLICITE
    }
    const parsed = JSON.parse(salvate)
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed
    }
    return RAPOARTE_IMPLICITE
  } catch (e) {
    console.error("Eroare la incarcarea rapoartelor:", e)
    return RAPOARTE_IMPLICITE
  }
}

export function salveazaRapoarte(rapoarte: RaportSalvat[]): void {
  try {
    localStorage.setItem(CHEIE_STORAGE_RAPOARTE, JSON.stringify(rapoarte))
  } catch (e) {
    console.error("Eroare la salvarea rapoartelor:", e)
  }
}

export function stergeRaportSalvat(id: string): RaportSalvat[] {
  const curente = incarcaRapoarteSalvate()
  const actualizate = curente.filter((r) => r.id !== id)
  salveazaRapoarte(actualizate)
  return actualizate
}

function formateazaDataOraSimpla(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0")
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function genereazaRaportNou(parametri: ParametriGenerareRaport): RaportSalvat {
  const cat = CATEGORII_RAPORT.find((c) => c.id === parametri.categorie) ?? CATEGORII_RAPORT[0]
  const acum = new Date()
  const acumFormatat = formateazaDataOraSimpla(acum)

  const titlu = parametri.titlu?.trim() || `Raport ${cat.titlu} - ${acumFormatat}`
  const operator = parametri.generatDe?.trim() || "Petrescu Razvan"
  const dInceput = parametri.perioadaInceput || "2026-05-01 00:00"
  const dSfarsit = parametri.perioadaSfarsit || acumFormatat

  let sumar: string
  let statistici: { eticheta: string; valoare: number | string }[]
  let elemente: RaportSalvat["elemente"]
  let recomandari: string[]

  switch (parametri.categorie) {
    case "incidente":
      sumar = `Analiza detaliata a incidentelor de securitate corelate in intervalul ${dInceput} - ${dSfarsit}. Au fost identificate si procesate 7 incidente operationale.`
      statistici = [
        { eticheta: "Total incidente", valoare: 7 },
        { eticheta: "Severitate critica", valoare: 1 },
        { eticheta: "Incidente deschise", valoare: 2 },
        { eticheta: "Timp mediu rezolvare", valoare: "12 min" },
      ]
      elemente = [
        {
          id: "INC-2026-901",
          titlu: "Tentativa acces neautorizat la serverul de bagaje",
          data: acumFormatat,
          severitate: "Critica",
          stare: "Investigare",
          dispozitiv: "SRV-BAG-01",
          detalii: "Conexiuni multiple pe porturi neautorizate si incercare escaladare privilegii",
        },
        {
          id: "INC-2026-902",
          titlu: "Deviatie camera CAM-01 identificata de modelul video ML",
          data: dInceput,
          severitate: "Ridicata",
          stare: "Izolat",
          dispozitiv: "CAM-01",
          detalii: "Camera a fost izolata preventiv din retea",
        },
      ]
      recomandari = [
        "Prioritizarea investigatiei pentru incidentele cu impact asupra fluxului de pasageri.",
        "Verificarea periodica a jurnalelor de firewall pe segmentele OT asociate.",
      ]
      break

    case "alerte":
      sumar = `Raport alerte de securitate generate in perioada ${dInceput} - ${dSfarsit}. Evaluarea include alerte generate automat de regulile de detectie si de modelele ML.`
      statistici = [
        { eticheta: "Total alerte", valoare: 18 },
        { eticheta: "Alerte critice", valoare: 2 },
        { eticheta: "Alerte deschise", valoare: 4 },
        { eticheta: "Reguli active", valoare: "12 active" },
      ]
      elemente = [
        {
          id: "ALT-101",
          titlu: "Tentativa de autentificare fortata (Brute-force SSH)",
          data: acumFormatat,
          severitate: "Ridicata",
          stare: "Deschisa",
          dispozitiv: "SRV-GATE-01",
          detalii: "GW-01: Peste 10 parole gresite in 60 secunde",
        },
        {
          id: "ALT-102",
          titlu: "Trafic anormal spre IP extern necunoscut",
          data: dInceput,
          severitate: "Medie",
          stare: "Rezolvata",
          dispozitiv: "CAM-01",
          detalii: "GW-02: Volum exfiltrare suspect detectat",
        },
      ]
      recomandari = [
        "Ajustarea pragurilor de sensibilitate pentru regulile cu frecventa ridicata.",
        "Asocierea alertelor necorelate cu noile scenarii din SIEM.",
      ]
      break

    case "dispozitive":
      sumar = `Inventar si stare de securitate pentru echipamentele aeroportuare in intervalul ${dInceput} - ${dSfarsit}. Include camere de supraveghere, turnicheti si servere.`
      statistici = [
        { eticheta: "Total dispozitive", valoare: 18 },
        { eticheta: "Camere operationale", valoare: "12 / 12" },
        { eticheta: "Dispozitive izolate", valoare: 0 },
        { eticheta: "Disponibilitate", valoare: "99.98%" },
      ]
      elemente = [
        {
          id: "DEV-CAM-01",
          titlu: "Camera Supraveghere Terminal Sosiri",
          data: acumFormatat,
          severitate: "Normala",
          stare: "Activ",
          dispozitiv: "CAM-01",
          detalii: "Flux RTSP stabil, securitate normala",
        },
        {
          id: "DEV-GATE-01",
          titlu: "Poarta Securitate Piste",
          data: dInceput,
          severitate: "Normala",
          stare: "Activ",
          dispozitiv: "GATE-01",
          detalii: "Control acces activ, scaner insigne operational",
        },
      ]
      recomandari = [
        "Scanarea de vulnerabilitati periodice a tuturor echipamentelor din perimetru.",
        "Pastrarea camerelor video intr-un VLAN separat fara acces direct la Internet.",
      ]
      break

    case "utilizatori":
      sumar = `Audit complet al actiunilor utilizatorilor, autentificarilor si accesului fizic/logic in intervalul ${dInceput} - ${dSfarsit}.`
      statistici = [
        { eticheta: "Sesiuni inregistrate", valoare: 142 },
        { eticheta: "Autentificari reusite", valoare: 139 },
        { eticheta: "Tentative esuate", valoare: 3 },
        { eticheta: "Conturi privilegiate", valoare: 4 },
      ]
      elemente = [
        {
          id: "USR-ACT-01",
          titlu: "Autentificare Operator SOC Petrescu Razvan",
          data: acumFormatat,
          severitate: "Normala",
          stare: "Succes",
          dispozitiv: "SOC-CONSOLE-1",
          detalii: "Sesiune activa fara incidente",
        },
        {
          id: "USR-ACT-02",
          titlu: "Scanare insigna personal tehnic la Poarta Sud",
          data: dInceput,
          severitate: "Scazuta",
          stare: "Autorizat",
          dispozitiv: "GATE-SOUTH-02",
          detalii: "Insigna validata cu succes",
        },
      ]
      recomandari = [
        "Impunerea autentificarii multifactor (MFA) pentru toate statiile de operare SOC.",
        "Dezactivarea conturilor inactive mai vechi de 30 de zile.",
      ]
      break

    case "retea":
      sumar = `Sinteza fluxurilor de retea si a inspectiei de pachete in perioada ${dInceput} - ${dSfarsit}. Monitorizarea protocoalelor critice (RTSP, SSH, HTTP).`
      statistici = [
        { eticheta: "Total fluxuri analizate", valoare: "124,500" },
        { eticheta: "Trafic total procesat", valoare: "42.8 GB" },
        { eticheta: "Conexiuni suspecte", valoare: 4 },
        { eticheta: "Porturi scanate blocate", valoare: 12 },
      ]
      elemente = [
        {
          id: "NET-FLW-501",
          titlu: "Scanare porturi TCP (SYN Scan)",
          data: acumFormatat,
          severitate: "Ridicata",
          stare: "Blocat",
          dispozitiv: "VLAN-SECURITY",
          detalii: "Porturi 22, 80, 443 sondate in interval de 3 secunde",
        },
      ]
      recomandari = [
        "Limitarea stricta a conexiunilor outbound catre IP-uri nespecificate in whitelist.",
        "Segmentarea riguroasa prin firewall a zonei de camere fata de sistemul IT general.",
      ]
      break

    case "ml":
      sumar = `Rezultatele algoritmilor de detectie a anomaliilor (Isolation Forest pentru telemetrie si analiza video) pentru perioada ${dInceput} - ${dSfarsit}.`
      statistici = [
        { eticheta: "Esantioane analizate", valoare: 28400 },
        { eticheta: "Scor anomalie mediu", valoare: "0.12" },
        { eticheta: "Alerte ML generate", valoare: 3 },
        { eticheta: "Acuratete detectie", valoare: "99.6%" },
      ]
      elemente = [
        {
          id: "ML-ANOM-12",
          titlu: "Anomalie flux video camera perimetru (GW-V01)",
          data: acumFormatat,
          severitate: "Critica",
          stare: "Confirmat",
          dispozitiv: "CAM-01",
          detalii: "Scor anomalie 0.89 - obstructionare fizica sau manipulare camera",
        },
      ]
      recomandari = [
        "Actualizarea periodica a setului de antrenare cu date din orele de varf.",
        "Corelarea semnalelor ML video cu alertele provenite din senzorii de perimetru.",
      ]
      break

    case "audit":
    default:
      sumar = `Raport general de audit si sinteza a starii securitatii cibernetice GateWatch pentru perioada ${dInceput} - ${dSfarsit}.`
      statistici = [
        { eticheta: "Total evenimente auditate", valoare: "85,400" },
        { eticheta: "Total incidente", valoare: 7 },
        { eticheta: "Dispozitive monitorizate", valoare: 18 },
        { eticheta: "Indice conformitate", valoare: "98.5%" },
      ]
      elemente = [
        {
          id: "AUD-GEN-01",
          titlu: "Inspectie reguli SIEM si corelare evenimente",
          data: acumFormatat,
          severitate: "Normala",
          stare: "Validat",
          dispozitiv: "SOC-ENGINE",
          detalii: "Toate regulile active; latenta corelare < 500ms",
        },
      ]
      recomandari = [
        "Continuarea monitorizarii 24/7 a indicilor de securitate.",
        "Planificarea exercitiului semestrial de securitate pentru simulare atac perimetral.",
      ]
      break
  }

  const nouRaport: RaportSalvat = {
    id: `rap-${Date.now().toString().slice(-6)}`,
    titlu,
    categorie: cat.id,
    numeCategorie: cat.titlu,
    generatLa: acumFormatat,
    generatDe: operator,
    perioadaInceput: dInceput,
    perioadaSfarsit: dSfarsit,
    sumar,
    statistici,
    elemente,
    recomandari,
  }

  const curente = incarcaRapoarteSalvate()
  const actualizate = [nouRaport, ...curente]
  salveazaRapoarte(actualizate)

  return nouRaport
}
