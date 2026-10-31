export type IdPagina =
  | 'panou'
  | 'camere'
  | 'incidente'
  | 'retea'
  | 'rapoarte'

type ElementNavigare = {
  id: IdPagina
  eticheta: string
  descriere: string
}

type PropsMeniuLateral = {
  paginaActiva: IdPagina
  onSchimbaPagina: (pagina: IdPagina) => void
}

const ELEMENTE_NAVIGARE: ElementNavigare[] = [
  { id: 'panou', eticheta: 'Panou principal', descriere: 'Vedere de ansamblu' },
  { id: 'camere', eticheta: 'Camere', descriere: 'Supraveghere video' },
  { id: 'incidente', eticheta: 'Incidente', descriere: 'Alerte și evenimente' },
  { id: 'retea', eticheta: 'Rețea', descriere: 'Infrastructură conectată' },
  { id: 'rapoarte', eticheta: 'Rapoarte', descriere: 'Analiză și export' },
]

function IconitaPagina({ pagina }: { pagina: IdPagina }) {
  const proprietatiComune = {
    width: 20,
    height: 20,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    focusable: false,
  }

  switch (pagina) {
    case 'panou':
      return (
        <svg {...proprietatiComune}>
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
      )
    case 'camere':
      return (
        <svg {...proprietatiComune}>
          <rect x="2.5" y="6" width="12" height="12" rx="2" />
          <path d="M14.5 10.5 21 7v10l-6.5-3.5" />
        </svg>
      )
    case 'incidente':
      return (
        <svg {...proprietatiComune}>
          <path d="M12 3 2.5 20h19L12 3Z" />
          <path d="M12 9v5" />
          <path d="M12 17h.01" />
        </svg>
      )
    case 'retea':
      return (
        <svg {...proprietatiComune}>
          <circle cx="5" cy="12" r="2.5" />
          <circle cx="19" cy="6" r="2.5" />
          <circle cx="19" cy="18" r="2.5" />
          <path d="M7.5 11 16.5 7" />
          <path d="m7.5 13 9 4" />
        </svg>
      )
    case 'rapoarte':
      return (
        <svg {...proprietatiComune}>
          <path d="M6 3h8l4 4v14H6Z" />
          <path d="M14 3v5h5" />
          <path d="M9 13h6" />
          <path d="M9 17h6" />
        </svg>
      )
  }
}

export function MeniuLateral({ paginaActiva, onSchimbaPagina }: PropsMeniuLateral) {
  return (
    <aside className="meniu-lateral">
      <nav aria-label="Navigare principală">
        <p className="meniu-lateral__titlu">Secțiuni</p>
        <ul className="meniu-lateral__lista">
          {ELEMENTE_NAVIGARE.map((element) => {
            const esteActiv = element.id === paginaActiva

            return (
              <li className="meniu-lateral__element" key={element.id}>
                <button
                  type="button"
                  className={`meniu-lateral__buton${esteActiv ? ' meniu-lateral__buton--activ' : ''}`}
                  aria-current={esteActiv ? 'page' : undefined}
                  onClick={() => onSchimbaPagina(element.id)}
                >
                  <span className="meniu-lateral__icon">
                    <IconitaPagina pagina={element.id} />
                  </span>
                  <span className="meniu-lateral__text">
                    <span className="meniu-lateral__eticheta">{element.eticheta}</span>
                    <span className="meniu-lateral__descriere">{element.descriere}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </nav>
    </aside>
  )
}
