// Panoul de control al simulatorului GateWatch: polling simplu, fără dependențe.
(function () {
  'use strict'

  const INTERVAL_MS = 1500
  const MAX_EVENIMENTE = 100
  const ACTIVITATE_RECENTA_MS = 20000
  const ZONE = {
    terminal: { x: 10, y: 10 },
    airside: { x: 325, y: 10 },
    perimeter: { x: 10, y: 185 },
    operations: { x: 325, y: 185 },
  }
  const ETICHETE_STARE = {
    idle: 'Inactiv', running: 'Rulează', paused: 'În așteptare (LIVE)', completed: 'Finalizat',
  }

  const $ = (id) => document.getElementById(id)
  // Câmpurile din evenimentele observed_http provin de la clienți arbitrari.
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
  const stare = { runId: null, lastSeq: 0, evenimente: [], activitate: {}, scenariu: null }

  const campToken = $('token')
  campToken.value = localStorage.getItem('gatewatch-admin-token') || 'gatewatch-admin'
  campToken.addEventListener('change', () => localStorage.setItem('gatewatch-admin-token', campToken.value))

  function afiseazaMesaj(text, eroare) {
    const el = $('mesaj')
    el.textContent = text
    el.classList.toggle('mesaj--eroare', Boolean(eroare))
  }

  async function cerere(cale, optiuni) {
    const raspuns = await fetch(cale, optiuni)
    if (!raspuns.ok) {
      let detaliu = raspuns.statusText
      try { detaliu = (await raspuns.json()).detail || detaliu } catch (_) { /* fără corp JSON */ }
      throw new Error(`${raspuns.status}: ${typeof detaliu === 'string' ? detaliu : JSON.stringify(detaliu)}`)
    }
    return raspuns.json()
  }

  function comanda(cale, corp) {
    return cerere(cale, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Token': campToken.value },
      body: corp ? JSON.stringify(corp) : undefined,
    })
  }

  async function executa(eticheta, actiune) {
    try {
      await actiune()
      afiseazaMesaj(`${eticheta}: OK`)
      await reimprospateaza()
    } catch (err) {
      afiseazaMesaj(`${eticheta}: ${err.message}`, true)
    }
  }

  $('btn-rulare-noua').addEventListener('click', () => executa('Rulare nouă', () => comanda('/sim/runs')))
  $('btn-auto').addEventListener('click', () => executa('Pornire AUTO', () => comanda('/sim/scenario/start', { mode: 'AUTO' })))
  $('btn-live').addEventListener('click', () => executa('Pornire LIVE', () => comanda('/sim/scenario/start', { mode: 'LIVE' })))
  $('btn-pas').addEventListener('click', () => executa('Pasul următor', () => comanda('/sim/scenario/step')))
  $('btn-stop').addEventListener('click', () => executa('Oprire', () => comanda('/sim/scenario/stop')))
  $('btn-baseline').addEventListener('click', () => executa('Trafic de bază', () => comanda('/sim/baseline', {
    enabled: $('baseline-activ').checked,
    rate: Number($('baseline-rata').value) || 1,
  })))
  $('filtru-sintetic').addEventListener('change', randeazaEvenimente)
  $('event-device').addEventListener('change', randeazaEvenimente)

  function randeazaHarta(dispozitive) {
    const grup = $('harta-dispozitive')
    const acum = Date.now()
    const peZone = {}
    dispozitive.forEach((d) => { (peZone[d.zone] = peZone[d.zone] || []).push(d) })

    const fragmente = []
    Object.entries(peZone).forEach(([zona, lista]) => {
      const origine = ZONE[zona]
      if (!origine) return
      lista.forEach((d, i) => {
        const x = origine.x + 45 + (i % 4) * 72
        const y = origine.y + 75 + Math.floor(i / 4) * 55
        const activ = acum - (stare.activitate[d.device_id] || 0) < ACTIVITATE_RECENTA_MS
        const clase = `dispozitiv dispozitiv--${d.status}${activ ? ' dispozitiv--activ' : ''}`
        fragmente.push(
          `<g class="${clase}" data-device="${esc(d.device_id)}" role="button" tabindex="0" aria-label="Select ${esc(d.device_id)}"><title>${d.device_id} · ${d.name} · ${d.ip} · ${d.status}</title>` +
          `<circle cx="${x}" cy="${y}" r="12"></circle>` +
          `<text x="${x}" y="${y + 28}">${d.device_id}</text></g>`,
        )
      })
    })
    grup.innerHTML = fragmente.join('')
    grup.querySelectorAll('[data-device]').forEach((marker) => {
      const select = () => document.dispatchEvent(new CustomEvent('select-device', { detail: marker.dataset.device }))
      marker.addEventListener('click', select)
      marker.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select() } })
    })
  }

  function randeazaScenariu(scenariu) {
    stare.scenariu = scenariu
    $('scenariu-nume').textContent = scenariu.name
    $('run-mode').textContent = scenariu.mode || '—'
    $('run-state').textContent = ETICHETE_STARE[scenariu.state] || scenariu.state
    $('btn-pas').disabled = !(scenariu.mode === 'LIVE' && scenariu.state === 'paused')

    $('etape').innerHTML = scenariu.stages.map((etapa) => {
      const urmatoare = !etapa.done && etapa.n === scenariu.current_stage + 1 &&
        (scenariu.state === 'running' || scenariu.state === 'paused')
      const clase = ['etapa',
        etapa.done ? (etapa.blocked ? 'etapa--blocata' : 'etapa--gata') : '',
        urmatoare ? 'etapa--urmatoare' : ''].join(' ')
      const nota = etapa.blocked ? ' (blocată — dispozitiv izolat)' : ''
      return `<li class="${clase}"><span class="etapa__nr">${etapa.n}</span>` +
        `<div><div class="etapa__nume">${etapa.name}${nota}</div>` +
        `<div class="etapa__descriere">${etapa.description}</div></div>` +
        `<span class="etapa__mitre">${etapa.mitre.technique_id} · ${etapa.mitre.tactic}</span></li>`
    }).join('')
  }

  function randeazaEvenimente() {
    const ascundeHeartbeat = $('filtru-sintetic').checked
    const ora = new Intl.DateTimeFormat('ro-RO', { timeStyle: 'medium', timeZone: 'Europe/Bucharest' })
    $('evenimente').innerHTML = stare.evenimente
      .filter((e) => !(ascundeHeartbeat && e.event_type === 'heartbeat'))
      .filter((e) => !$('event-device').value || e.device_id === $('event-device').value)
      .map((e) => `<tr class="origine--${esc(e.origin)}"><td>${esc(e.seq)}</td>` +
        `<td>${ora.format(new Date(e.occurred_at))}</td><td>${esc(e.device_id)}</td><td>${esc(e.event_type)}</td>` +
        `<td class="rezultat--${esc(e.outcome)}">${esc(e.outcome)}</td><td>${esc(e.origin)}</td>` +
        `<td>${esc(e.source.ip)} → ${esc(e.target.ip)}${e.target.port ? ':' + esc(e.target.port) : ''}</td></tr>`)
      .join('')
  }

  async function reimprospateaza() {
    const sanatate = await cerere('/sim/health')
    if (sanatate.run_id !== stare.runId) {
      stare.runId = sanatate.run_id
      stare.lastSeq = 0
      stare.evenimente = []
      stare.activitate = {}
    }
    $('run-id').textContent = sanatate.run_id

    const lot = await cerere(`/sim/events?run_id=${encodeURIComponent(stare.runId)}&after_seq=${stare.lastSeq}&limit=1000`)
    if (lot.events.length) {
      stare.lastSeq = lot.last_seq
      lot.events.forEach((e) => {
        if (e.origin !== 'synthetic') stare.activitate[e.device_id] = Date.now()
      })
      stare.evenimente = lot.events.slice().reverse().concat(stare.evenimente).slice(0, MAX_EVENIMENTE)
      randeazaEvenimente()
    }
    $('run-seq').textContent = String(stare.lastSeq)

    const [dispozitive, scenariu] = await Promise.all([cerere('/sim/devices'), cerere('/sim/scenario')])
    randeazaHarta(dispozitive)
    randeazaScenariu(scenariu)
  }

  async function bucla() {
    const indicator = $('indicator-conexiune')
    try {
      await reimprospateaza()
      indicator.textContent = 'Simulator activ'
      indicator.className = 'insigna insigna--buna'
    } catch (err) {
      indicator.textContent = 'Simulator indisponibil'
      indicator.className = 'insigna insigna--alerta'
    }
    setTimeout(bucla, INTERVAL_MS)
  }

  bucla()
})()
