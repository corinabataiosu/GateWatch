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
          GW
        </span>
        <span className="antet__identitate">
          <span className="antet__titlu">GateWatch</span>
          <span className="antet__subtitlu">Supraveghere aeroportuară</span>
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
