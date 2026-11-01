type ProprietatiAntet = {
  socConectat: boolean
  seIncarca: boolean
}

export function Antet({ socConectat, seIncarca }: ProprietatiAntet) {
  const eticheta = seIncarca
    ? 'Conectare la SOC...'
    : socConectat
      ? 'SOC conectat'
      : 'SOC indisponibil · mod demonstrativ'
  const modificator = seIncarca ? 'asteptare' : socConectat ? 'conectat' : 'deconectat'

  return (
    <header className="antet">
      <div className="antet__marca">
        <span className="antet__logo" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="5" width="13" height="6" rx="1.5" transform="rotate(12 10.5 8)" />
            <path d="M17.4 8.6 20.5 7.8v4.4l-3.4-.9" />
            <path d="M9 11.8 8 15.5H3.5" />
            <path d="M3.5 13v5" />
          </svg>
        </span>
        <span className="antet__identitate">
          <span className="antet__titlu">GateWatch</span>
        </span>
      </div>

      <div className="antet__actiuni">
        <span
          className={`indicator-demonstrativ indicator-demonstrativ--${modificator}`}
          role="status"
        >
          <span className="indicator-demonstrativ__punct" aria-hidden="true" />
          {eticheta}
        </span>
      </div>
    </header>
  )
}
