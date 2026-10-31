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

  const etichete = {
  "success": "Reușit",
  "failure": "Eșuat",
  "info": "Informativ",
  "synthetic": "Trafic de bază",
  "scenario_generated": "Simulare",
  "observed_http": "Cerere HTTP observată",
  "heartbeat": "Semnal de funcționare",
  "auth_login": "Autentificare",
  "auth_logout": "Deconectare",
  "config_change": "Modificare configurație",
  "firmware_update": "Actualizare firmware",
  "stream_status": "Stare flux video",
  "snapshot_access": "Acces imagine",
  "recording_access": "Acces înregistrare",
  "recording_export": "Export înregistrare",
  "recording_delete": "Ștergere înregistrare",
  "badge_access": "Acces cu ecuson",
  "door_state": "Stare ușă",
  "vpn_session": "Sesiune VPN",
  "network_scan": "Scanare rețea",
  "log_cleared": "Jurnal șters",
  "connection_attempt": "Încercare de conectare",
  "access_denied": "Acces refuzat",
  "network_flow": "Flux de rețea"
}
  const tr = value => etichete[value] || value
  const $ = (id) => document.getElementById(id)
  // Câmpurile din evenimentele observed_http provin de la clienți arbitrari.
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
  const stare = { runId: null, lastSeq: 0, evenimente: [], activitate: {} }

  async function cerere(cale, optiuni) {
    const raspuns = await fetch(cale, optiuni)
    if (!raspuns.ok) {
      let detaliu = raspuns.statusText
      try { detaliu = (await raspuns.json()).detail || detaliu } catch (_) { /* fără corp JSON */ }
      throw new Error(`${raspuns.status}: ${typeof detaliu === 'string' ? detaliu : JSON.stringify(detaliu)}`)
    }
    return raspuns.json()
  }

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
        const selected = $('device-select').value === d.device_id
        const clase = `dispozitiv dispozitiv--${d.status}${activ ? ' dispozitiv--activ' : ''}${selected ? ' dispozitiv--selected' : ''}`
        fragmente.push(
          `<g class="${clase}" data-device="${esc(d.device_id)}" role="button" tabindex="0" aria-label="Selectează ${esc(d.device_id)}"><title>${d.device_id} · ${d.name} · ${d.ip} · ${d.status}</title>` +
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

  function randeazaEvenimente() {
    const ascundeHeartbeat = $('filtru-sintetic').checked
    const ora = new Intl.DateTimeFormat('ro-RO', { timeStyle: 'medium', timeZone: 'Europe/Bucharest' })
    $('evenimente').innerHTML = stare.evenimente
      .filter((e) => !(ascundeHeartbeat && e.event_type === 'heartbeat'))
      .filter((e) => !$('event-device').value || e.device_id === $('event-device').value)
      .map((e) => `<tr class="origine--${esc(e.origin)}"><td>${esc(e.seq)}</td>` +
        `<td>${ora.format(new Date(e.occurred_at))}</td><td>${esc(e.device_id)}</td><td>${esc(tr(e.event_type))}</td>` +
        `<td class="rezultat--${esc(e.outcome)}">${esc(tr(e.outcome))}</td><td>${esc(tr(e.origin))}</td>` +
        `<td>${esc(e.source.ip)} → ${esc(e.target.ip)}${e.target.port ? ':' + esc(e.target.port) : ''}</td></tr>`)
      .join('')
  }

  async function reimprospateaza() {
    // Device selection must remain available even if event history cannot be loaded.
    const dispozitive = await cerere('/sim/devices')
    randeazaHarta(dispozitive)
    const sanatate = await cerere('/sim/health')
    if (sanatate.run_id !== stare.runId) {
      stare.runId = sanatate.run_id
      stare.lastSeq = 0
      stare.evenimente = []
      stare.activitate = {}
    }

    const lot = await cerere(`/sim/events?run_id=${encodeURIComponent(stare.runId)}&after_seq=${stare.lastSeq}&limit=1000`)
    if (lot.events.length) {
      stare.lastSeq = lot.last_seq
      lot.events.forEach((e) => {
        if (e.origin !== 'synthetic') stare.activitate[e.device_id] = Date.now()
      })
      stare.evenimente = lot.events.slice().reverse().concat(stare.evenimente).slice(0, MAX_EVENIMENTE)
      randeazaEvenimente()
    }
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
