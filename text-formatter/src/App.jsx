import { useRef, useState } from 'react'
import './App.css'

const initialForm = {
  eventName: '',
  statusUpdate: 'Setup done',
  collectionDate: '',
  notes: '',
}

const createRouter = (id) => ({
  id,
  model: 'E3000',
  routerId: '',
  mode: 'Round Robin',
  provider: 'StarHub / Singtel',
  includeAccessPoint: false,
  accessPointId: '',
})

const createNetwork = (id) => ({ id, ssid: '', password: '' })

function formatCollectionDate(value) {
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))

  return new Intl.DateTimeFormat('en-SG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}

function buildMessage(form, routers, networks) {
  const isCollectionDone = form.statusUpdate === 'Collection done'
  const updateType = isCollectionDone ? 'Collection' : 'Setup'
  const lines = [`${updateType} completed for Event @ ${form.eventName.trim()}`]

  if (!isCollectionDone) {
    routers.forEach((router) => {
      const routerLine = `${router.model} - ${router.routerId.trim()}${router.includeAccessPoint ? ' + AP' : ''}`
      const mode = router.mode === 'Round Robin' ? 'RR' : 'Spillover'

      lines.push('', routerLine, `${router.provider} ${mode}`)

      if (router.includeAccessPoint) {
        lines.push(`AP Cloud ID: ${router.accessPointId.trim()}`)
      }
    })
  }

  if (!isCollectionDone && form.collectionDate) {
    lines.push('', `Collection: ${formatCollectionDate(form.collectionDate)}`)
  }

  if (!isCollectionDone) {
    const completedNetworks = networks.filter(
      (network) => network.ssid.trim() && network.password.trim(),
    )

    completedNetworks.forEach((network, index) => {
      const suffix = completedNetworks.length > 1 ? ` ${index + 1}` : ''
      lines.push(
        '',
        `SSID${suffix}: ${network.ssid.trim()}`,
        `Password${suffix}: ${network.password.trim()}`,
      )
    })
  }

  if (form.notes.trim()) lines.push('', `Notes: ${form.notes.trim()}`)

  return lines.join('\n')
}

function copyWithFallback(text) {
  const textArea = document.createElement('textarea')
  textArea.value = text
  textArea.style.position = 'fixed'
  textArea.style.opacity = '0'

  try {
    document.body.appendChild(textArea)
    textArea.select()
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    textArea.remove()
  }
}

function App() {
  const [form, setForm] = useState(initialForm)
  const [routers, setRouters] = useState([createRouter(1)])
  const [networks, setNetworks] = useState([createNetwork(1)])
  const [errors, setErrors] = useState({})
  const [routerErrors, setRouterErrors] = useState({})
  const [networkErrors, setNetworkErrors] = useState({})
  const [output, setOutput] = useState('')
  const [copyStatus, setCopyStatus] = useState('idle')
  const nextRouterId = useRef(2)
  const nextNetworkId = useRef(2)
  const outputRef = useRef(null)

  function clearOutput() {
    setOutput('')
    setCopyStatus('idle')
  }

  function updateField(event) {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
    setErrors((current) => ({
      ...current,
      [name]: '',
    }))
    if (name === 'statusUpdate' && value === 'Collection done') {
      setRouterErrors({})
      setNetworkErrors({})
    }
    clearOutput()
  }

  function updateRouter(id, field, value) {
    setRouters((current) =>
      current.map((router) =>
        router.id === id ? { ...router, [field]: value } : router,
      ),
    )
    setRouterErrors((current) => ({
      ...current,
      [id]: {
        ...current[id],
        [field]: '',
        ...(field === 'includeAccessPoint' && !value ? { accessPointId: '' } : {}),
      },
    }))
    clearOutput()
  }

  function addRouter() {
    const id = nextRouterId.current
    nextRouterId.current += 1
    setRouters((current) => [...current, createRouter(id)])
    clearOutput()
  }

  function removeRouter(id) {
    setRouters((current) => current.filter((router) => router.id !== id))
    setRouterErrors((current) => {
      const next = { ...current }
      delete next[id]
      return next
    })
    clearOutput()
  }

  function updateNetwork(id, field, value) {
    setNetworks((current) =>
      current.map((network) =>
        network.id === id ? { ...network, [field]: value } : network,
      ),
    )
    setNetworkErrors((current) => ({
      ...current,
      [id]: { ...current[id], [field]: '' },
    }))
    clearOutput()
  }

  function addNetwork() {
    const id = nextNetworkId.current
    nextNetworkId.current += 1
    setNetworks((current) => [...current, createNetwork(id)])
    clearOutput()
  }

  function removeNetwork(id) {
    setNetworks((current) => current.filter((network) => network.id !== id))
    setNetworkErrors((current) => {
      const next = { ...current }
      delete next[id]
      return next
    })
    clearOutput()
  }

  function formatMessage(event) {
    event.preventDefault()
    const nextErrors = {}
    const nextRouterErrors = {}
    const nextNetworkErrors = {}
    const isCollectionDone = form.statusUpdate === 'Collection done'

    if (!form.eventName.trim()) nextErrors.eventName = 'Enter an event name.'
    if (!isCollectionDone) {
      routers.forEach((router) => {
        const currentErrors = {}

        if (!router.routerId.trim()) currentErrors.routerId = 'Enter a router ID.'
        if (
          router.includeAccessPoint &&
          !/^\d{4}$/.test(router.accessPointId.trim())
        ) {
          currentErrors.accessPointId = 'Enter the last 4 digits.'
        }

        if (Object.keys(currentErrors).length) {
          nextRouterErrors[router.id] = currentErrors
        }
      })

      networks.forEach((network) => {
        const hasSsid = Boolean(network.ssid.trim())
        const hasPassword = Boolean(network.password.trim())

        if (hasSsid && !hasPassword) {
          nextNetworkErrors[network.id] = { password: 'Enter the password.' }
        } else if (!hasSsid && hasPassword) {
          nextNetworkErrors[network.id] = { ssid: 'Enter the SSID.' }
        }
      })
    }

    setErrors(nextErrors)
    setRouterErrors(nextRouterErrors)
    setNetworkErrors(nextNetworkErrors)

    if (
      Object.keys(nextErrors).length ||
      Object.keys(nextRouterErrors).length ||
      Object.keys(nextNetworkErrors).length
    ) {
      window.setTimeout(() => {
        document.querySelector('[aria-invalid="true"]')?.focus()
      }, 0)
      return
    }

    setOutput(buildMessage(form, routers, networks))
    setCopyStatus('idle')
    window.setTimeout(() => {
      outputRef.current?.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'auto'
          : 'smooth',
        block: 'nearest',
      })
    }, 0)
  }

  async function copyOutput() {
    if (!output) return
    let copied

    try {
      await navigator.clipboard.writeText(output)
      copied = true
    } catch {
      copied = copyWithFallback(output)
    }

    setCopyStatus(copied ? 'copied' : 'error')
  }

  function resetForm() {
    setForm(initialForm)
    setRouters([createRouter(1)])
    setNetworks([createNetwork(1)])
    nextRouterId.current = 2
    nextNetworkId.current = 2
    setErrors({})
    setRouterErrors({})
    setNetworkErrors({})
    setOutput('')
    setCopyStatus('idle')
  }

  function addNoIssuesNote() {
    const quickReply = 'No issues were mentioned by customer.'
    if (form.notes.includes(quickReply)) return

    setForm((current) => ({
      ...current,
      notes: current.notes.trim()
        ? `${current.notes.trim()}\n${quickReply}`
        : quickReply,
    }))
    clearOutput()
  }

  return (
    <main className="page">
      <header className="page-header">
        <h1>Event Update</h1>
      </header>

      <form className="form" onSubmit={formatMessage} noValidate>
        <section className="form-section event-section" aria-label="Event">
          <div className="field-grid two-columns">
            <label className="field">
              <span>Event *</span>
              <input
                name="eventName"
                value={form.eventName}
                onChange={updateField}
                placeholder="e.g. Unearthed Productions"
                aria-invalid={Boolean(errors.eventName)}
                aria-describedby={errors.eventName ? 'event-error' : undefined}
              />
              {errors.eventName && <small id="event-error">{errors.eventName}</small>}
            </label>

            <fieldset className="status-field">
              <legend>Status</legend>
              <div className="status-options">
                {['Setup done', 'Collection done'].map((status) => (
                  <label className="status-option" key={status}>
                    <input
                      type="radio"
                      name="statusUpdate"
                      value={status}
                      checked={form.statusUpdate === status}
                      onChange={updateField}
                    />
                    <span>{status}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
        </section>

        <section
          className="form-section"
          hidden={form.statusUpdate === 'Collection done'}
        >
          <div className="section-title-row">
            <h2>Routers</h2>
            <button className="text-button" type="button" onClick={addRouter}>
              + Router
            </button>
          </div>

          <div className="router-list">
            {routers.map((router, index) => (
              <div className="router-block" key={router.id}>
                {routers.length > 1 && (
                  <div className="router-block-header">
                    <strong>Router {index + 1}</strong>
                    <button
                      className="inline-remove"
                      type="button"
                      onClick={() => removeRouter(router.id)}
                      aria-label={`Remove router ${index + 1}`}
                    >
                      Remove
                    </button>
                  </div>
                )}

                <div className="field-grid two-columns">
                  <label className="field">
                    <span>Model</span>
                    <select
                      value={router.model}
                      onChange={(event) => updateRouter(router.id, 'model', event.target.value)}
                      aria-label={`Router ${index + 1} model`}
                    >
                      <option>E3000</option>
                      <option>AER2200</option>
                      <option>Peplink</option>
                    </select>
                  </label>

                  <label className="field">
                    <span>ID *</span>
                    <div className="router-id-input">
                      <b>{router.model} -</b>
                      <input
                        value={router.routerId}
                        onChange={(event) => updateRouter(router.id, 'routerId', event.target.value)}
                        placeholder="5"
                        aria-label={`Router ${index + 1} ID`}
                        aria-invalid={Boolean(routerErrors[router.id]?.routerId)}
                        aria-describedby={routerErrors[router.id]?.routerId ? `router-error-${router.id}` : undefined}
                      />
                    </div>
                    {routerErrors[router.id]?.routerId && (
                      <small id={`router-error-${router.id}`}>
                        {routerErrors[router.id].routerId}
                      </small>
                    )}
                  </label>

                  <label className="field">
                    <span>Mode</span>
                    <select
                      value={router.mode}
                      onChange={(event) => updateRouter(router.id, 'mode', event.target.value)}
                      aria-label={`Router ${index + 1} mode`}
                    >
                      <option>Round Robin</option>
                      <option>Spillover</option>
                    </select>
                  </label>

                  <label className="field">
                    <span>Provider</span>
                    <select
                      value={router.provider}
                      onChange={(event) => updateRouter(router.id, 'provider', event.target.value)}
                      aria-label={`Router ${index + 1} network provider`}
                    >
                      <option>StarHub / Singtel</option>
                      <option>Singtel / StarHub</option>
                      <option>Singtel only</option>
                      <option>StarHub only</option>
                    </select>
                  </label>
                </div>

                <div className="ap-row">
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={router.includeAccessPoint}
                      onChange={(event) => updateRouter(router.id, 'includeAccessPoint', event.target.checked)}
                    />
                    Include AP
                  </label>

                  {router.includeAccessPoint && (
                    <label className="field ap-id">
                      <span>AP Cloud ID *</span>
                      <input
                        value={router.accessPointId}
                        onChange={(event) => updateRouter(router.id, 'accessPointId', event.target.value)}
                        placeholder="Last 4 digits"
                        maxLength="4"
                        inputMode="numeric"
                        pattern="[0-9]{4}"
                        aria-label={`Router ${index + 1} AP Cloud ID`}
                        aria-invalid={Boolean(routerErrors[router.id]?.accessPointId)}
                        aria-describedby={routerErrors[router.id]?.accessPointId ? `ap-error-${router.id}` : undefined}
                      />
                      {routerErrors[router.id]?.accessPointId && (
                        <small id={`ap-error-${router.id}`}>
                          {routerErrors[router.id].accessPointId}
                        </small>
                      )}
                    </label>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section
          className="form-section"
          hidden={form.statusUpdate === 'Collection done'}
        >
          <div className="section-title-row">
            <h2>Wi-Fi</h2>
            <button className="text-button" type="button" onClick={addNetwork}>
              + Wi-Fi
            </button>
          </div>

          <div className="network-list">
            {networks.map((network, index) => (
              <div
                className={`network-row ${networks.length === 1 ? 'single-network' : ''}`}
                key={network.id}
              >
                {networks.length > 1 && (
                  <span className="network-number">{index + 1}</span>
                )}

                <label className="field">
                  <span>SSID</span>
                  <input
                    value={network.ssid}
                    onChange={(event) => updateNetwork(network.id, 'ssid', event.target.value)}
                    placeholder="Network name"
                    aria-label={`Wi-Fi network ${index + 1} SSID`}
                    aria-invalid={Boolean(networkErrors[network.id]?.ssid)}
                    aria-describedby={networkErrors[network.id]?.ssid ? `ssid-error-${network.id}` : undefined}
                  />
                  {networkErrors[network.id]?.ssid && (
                    <small id={`ssid-error-${network.id}`}>{networkErrors[network.id].ssid}</small>
                  )}
                </label>

                <label className="field">
                  <span>Password</span>
                  <input
                    value={network.password}
                    onChange={(event) => updateNetwork(network.id, 'password', event.target.value)}
                    placeholder="Network password"
                    aria-label={`Wi-Fi network ${index + 1} password`}
                    aria-invalid={Boolean(networkErrors[network.id]?.password)}
                    aria-describedby={networkErrors[network.id]?.password ? `password-error-${network.id}` : undefined}
                  />
                  {networkErrors[network.id]?.password && (
                    <small id={`password-error-${network.id}`}>{networkErrors[network.id].password}</small>
                  )}
                </label>

                {networks.length > 1 && (
                  <button
                    className="remove-button"
                    type="button"
                    onClick={() => removeNetwork(network.id)}
                    aria-label={`Remove Wi-Fi network ${index + 1}`}
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>

        <section
          className="form-section"
          hidden={form.statusUpdate === 'Collection done'}
        >
          <h2>Collection date</h2>
          <label className="field">
            <span className="sr-only">Collection date</span>
            <input
              type="date"
              name="collectionDate"
              value={form.collectionDate}
              onChange={updateField}
            />
          </label>
        </section>

        <section className="form-section">
          <div className="section-title-row notes-title-row">
            <h2>Notes</h2>
            <button className="quick-reply" type="button" onClick={addNoIssuesNote}>
              No issues
            </button>
          </div>
          <label className="field">
            <span className="sr-only">Notes</span>
            <textarea
              name="notes"
              value={form.notes}
              onChange={updateField}
              placeholder="Add a note"
              rows="4"
            />
          </label>
        </section>

        <div className="form-actions">
          <button className="clear-button" type="button" onClick={resetForm}>
            Reset
          </button>
          <button className="primary-button" type="submit">
            Generate
          </button>
        </div>
      </form>

      {output && (
        <section className="output" ref={outputRef}>
          <div className="output-header">
            <h2>Message</h2>
            <button type="button" onClick={copyOutput}>
              {copyStatus === 'copied'
                ? 'Copied'
                : copyStatus === 'error'
                  ? 'Copy failed'
                  : 'Copy'}
            </button>
          </div>

          <pre>{output}</pre>

          <span className="sr-only" role="status" aria-live="polite">
            {copyStatus === 'copied'
              ? 'Message copied to clipboard.'
              : copyStatus === 'error'
                ? 'Copy failed. Select and copy the message manually.'
                : ''}
          </span>
        </section>
      )}
    </main>
  )
}

export default App
