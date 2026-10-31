// Independent manual controls; configuration never produces events.
(() => {
  'use strict'
  const $ = (id) => document.getElementById(id)
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`)
  let devices = [], catalog = [], signature = '', busy = false, requestId = null, executionError = false, nextAllowed = 0, initialized = false
  const form = $('attack-form'), button = $('execute-attack')
  const numeric = id => Number($(id).value)
  async function get(path) {
    const response = await fetch(path)
    if (!response.ok) throw new Error(`Server returned ${response.status}`)
    return response.json()
  }
  function selected() { return devices.find(d => d.device_id === $('device-select').value) }
  function configure() {
    const d = selected(), attack = $('attack-select').value
    const lateral = attack === 'lateral_movement', flood = attack === 'dos', exfil = attack === 'exfiltration'
    const outbound = lateral || exfil || flood && $('attack-direction').value === 'outbound'
    const show = (id, visible) => {
      $(id).hidden = !visible
      $(id).querySelectorAll('input,select').forEach(el => { el.disabled = !visible })
    }
    show('field-direction', flood); show('field-external', !lateral); show('field-destination', lateral)
    show('field-count', !flood && !exfil); show('field-pps', flood); show('field-bps', exfil)
    show('field-port', flood || lateral || exfil)
    $('external-label').textContent = outbound ? 'Fictional external destination IP' : 'Simulated external source IP'
    $('count-label').textContent = attack === 'port_scan' ? 'Distinct virtual ports' : 'Requests / attempts'
    $('attack-description').textContent = catalog.find(a => a.id === attack)?.description || ''
    $('device-summary').innerHTML = d ? [['Device',d.device_id],['Type',d.type],['Virtual IP',d.ip],['Zone',d.zone],['Status',d.status]].map(([k,v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('') : ''
    const incompatible = exfil && d?.type === 'access_control'
    const target = devices.find(d => d.device_id === $('attack-destination').value)
    const port = numeric('attack-port') || (target?.type === 'camera' ? 80 : target?.type === 'iot_gateway' ? 8883 : 443)
    const allowed = lateral && d && target && (d.type === 'camera' && target.type === 'nvr' && [443,554].includes(port) || d.type === 'iot_gateway' && port === 8883 || d.type === 'vpn_gateway' && target.type === 'iot_gateway' && port === 443)
    const error = !d ? 'Select a device.' : d.status !== 'online' ? 'This device is not online. Restore it or select another device.' : incompatible ? 'Access controllers do not support the bulk-data demo profile.' : lateral && (!target || target.device_id === d.device_id || target.status !== 'online') ? 'Choose a different online destination device.' : allowed ? 'This link is permitted by the virtual network policy. Choose a forbidden destination or port.' : ''
    $('attack-validation').textContent = error
    button.disabled = busy || Date.now() < nextAllowed || Boolean(error) || !catalog.length
    const src = outbound ? d?.ip : $('attack-external').value
    const dst = lateral ? target?.ip : outbound ? $('attack-external').value : d?.ip
    $('attack-preview').textContent = `${src || '—'} → ${dst || '—'} · ${flood ? (numeric('attack-pps') * numeric('attack-duration')).toLocaleString() + ' virtual packets' : exfil ? (numeric('attack-bps') * numeric('attack-duration') / 1000000).toFixed(1) + ' MB virtual transfer' : numeric('attack-count') + ' observations'}`
    document.querySelectorAll('[data-device]').forEach(el => el.classList.toggle('dispozitiv--selected', el.dataset.device === d?.device_id))
  }
  function renderResults(results) {
    $('execution-results').innerHTML = results.length ? results.map(r => {
      const attack = catalog.find(a => a.id === r.attack)?.name || r.attack
      const fields = [['Device',r.device_id],['Source → destination',`${r.source_ip} → ${r.destination_ip}`],['Started',r.started_at],['Completed',r.completed_at || '—'],['Virtual duration',`${r.virtual_duration_s || '—'} seconds`],['Observations',r.event_count],['Virtual packets / requests',r.packet_count],['Virtual traffic',`${Number(r.total_bytes).toLocaleString()} bytes`]]
      return `<article class="execution"><div class="card__antet"><strong>${esc(attack)}</strong><span class="insigna ${r.status === 'completed' ? 'insigna--buna' : 'insigna--alerta'}">${esc(r.status)}</span></div><p class="execution-id">${esc(r.execution_id)}</p><dl class="campuri">${fields.map(([k,v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl><p class="hint">${esc(Object.entries(r.summary).map(([k,v]) => `${k}: ${v}`).join(' · '))}</p>${r.errors.map(e => `<p class="mesaj--eroare">${esc(e)}</p>`).join('')}<p class="hint">Simulator execution only. Review independent detections in the SOC dashboard.</p></article>`
    }).join('') : '<p class="hint">No manual executions in this run.</p>'
  }
  async function refresh() {
    const [inventory, executions, health] = await Promise.all([get('/sim/devices'), get('/sim/executions'), get('/sim/health')])
    $('baseline-status').textContent = health.baseline.enabled ? 'Baseline active' : 'Baseline paused'
    if (!initialized) {
      $('baseline-activ').checked = health.baseline.enabled
      $('baseline-rata').value = health.baseline.rate
      initialized = true
    }
    devices = inventory
    const next = JSON.stringify(devices.map(({device_id,status}) => [device_id,status]))
    if (next !== signature) {
      signature = next
      const options = devices.map(d => `<option value="${esc(d.device_id)}">${esc(d.device_id)} · ${esc(d.ip)} · ${esc(d.status)}</option>`).join('')
      for (const id of ['device-select','attack-destination','event-device']) {
        const prior = $(id).value
        $(id).innerHTML = (id === 'event-device' ? '<option value="">All devices</option>' : '<option value="">Select a device…</option>') + (id === 'device-select' ? [...new Set(devices.map(d => d.zone))].map(zone => `<optgroup label="${esc(zone)}">${devices.filter(d => d.zone === zone).map(d => `<option value="${esc(d.device_id)}">${esc(d.device_id)} · ${esc(d.ip)}</option>`).join('')}</optgroup>`).join('') : options)
        $(id).value = prior
      }
    }
    if (!busy && !executionError) renderResults(executions.slice(0, 1))
    configure()
  }
  form.addEventListener('input', () => { requestId = null; configure() })
  form.addEventListener('change', () => { requestId = null; configure() })
  document.addEventListener('select-device', e => { if (!busy) { $('device-select').value = e.detail; requestId = null; configure() } })
  form.addEventListener('submit', e => e.preventDefault())
  button.addEventListener('click', async e => {
    e.preventDefault()
    if (busy || button.disabled || !form.reportValidity()) return
    busy = true
    nextAllowed = Date.now() + 1000
    executionError = false
    requestId ||= crypto.randomUUID()
    const attack = $('attack-select').value
    const body = {execution_id: requestId, device_id: $('device-select').value, attack,
      duration_s: numeric('attack-duration')}
    if (attack !== 'lateral_movement') body.external_ip = $('attack-external').value
    if (attack === 'lateral_movement') body.destination_device_id = $('attack-destination').value
    if (attack === 'dos') { body.direction = $('attack-direction').value; body.packets_per_second = numeric('attack-pps') }
    if (attack === 'exfiltration') body.bytes_per_second = numeric('attack-bps')
    if (!['dos','exfiltration'].includes(attack)) body.count = numeric('attack-count')
    if (!$('attack-port').disabled && $('attack-port').value) body.port = numeric('attack-port')
    form.querySelectorAll('input,select').forEach(el => { el.disabled = true })
    button.disabled = true; button.textContent = 'Executing…'
    $('execution-results').textContent = 'Generating and persisting virtual observations…'
    try {
      const response = await fetch('/sim/attacks/execute', {method:'POST',headers:{'Content-Type':'application/json','X-Admin-Token':$('token').value},body:JSON.stringify(body)})
      const result = await response.json()
      if (!response.ok) throw new Error(typeof result.detail === 'string' ? result.detail : JSON.stringify(result.detail))
      renderResults([result]); requestId = null
    } catch (error) {
      executionError = true
      $('execution-results').textContent = `Execution error: ${error.message}. If the connection failed, retry unchanged settings to recover the same execution ID.`
    } finally {
      busy = false
      form.querySelectorAll('input,select').forEach(el => { el.disabled = false })
      button.textContent = 'Execute Attack'; configure()
      setTimeout(configure, Math.max(0, nextAllowed - Date.now()))
    }
  })
  async function loop() {
    try {
      if (!catalog.length) {
        catalog = await get('/sim/attacks')
        $('attack-select').innerHTML = catalog.map(a => `<option value="${esc(a.id)}">${esc(a.name)}</option>`).join('')
      }
      if (!busy) await refresh()
    } catch (error) { button.disabled = true; $('attack-validation').textContent = `Manual controls unavailable: ${error.message}` }
    setTimeout(loop, 1500)
  }
  loop()
})()
