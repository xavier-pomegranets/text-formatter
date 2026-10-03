const quickActions = {
  'Setup done': [
    { label: 'Connection tested', text: 'Internet connection tested and working.' },
    { label: 'Wi-Fi shared', text: 'Wi-Fi details shared with the customer.' },
    { label: 'Handover done', text: 'Equipment handover completed with the customer.' },
  ],
  'Collection done': [
    { label: 'No issues', text: 'No issues were mentioned by customer.' },
    { label: 'All equipment collected', text: 'All equipment and accessories collected.' },
    { label: 'Equipment checked', text: 'Collected equipment checked and in good condition.' },
  ],
}

function getEventDetailsSummary(form, networks) {
  if (form.statusUpdate === 'Collection done') {
    return form.notes.trim() ? 'Notes added' : 'Notes'
  }

  const startedNetworks = networks.filter(
    (network) => network.ssid.trim() || network.password.trim(),
  ).length
  const details = []

  if (startedNetworks) {
    details.push(`${startedNetworks} Wi-Fi${startedNetworks === 1 ? '' : ' networks'}`)
  }
  if (form.collectionDate || form.collectionTime) {
    details.push('Collection set')
  }
  if (form.notes.trim()) details.push('Notes added')

  if (details.length) return details.join(' \u00b7 ')

  return 'Wi-Fi, collection and notes'
}

export default function EventDetails({
  form,
  networks,
  networkErrors,
  updateField,
  updateNetwork,
  addNetwork,
  removeNetwork,
  addNote,
}) {
  const isCollection = form.statusUpdate === 'Collection done'
  const actions = quickActions[form.statusUpdate] ?? []

  return (
    <details className="form-section optional-details">
      <summary>
        <span className="optional-details-title">
          <span className="section-step" aria-hidden="true">
            {isCollection ? '2' : '3'}
          </span>
          <strong>More event details</strong>
        </span>
        <small>{getEventDetailsSummary(form, networks)}</small>
      </summary>

      <div className="optional-details-content">
        <div className="optional-group" hidden={isCollection}>
          <div className="subsection-heading">
            <div>
              <h2>Wi-Fi</h2>
              <p>Add only when the event network needs to be shared.</p>
            </div>
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

          <button className="text-button add-button" type="button" onClick={addNetwork}>
            Add another Wi-Fi network
          </button>
        </div>

        <div className="optional-group" hidden={isCollection}>
          <div className="subsection-heading">
            <div>
              <h2>Collection</h2>
              <p>Add the planned collection date or time.</p>
            </div>
          </div>
          <div className="field-grid two-columns collection-fields">
            <label className="field">
              <span>Date</span>
              <input
                type="date"
                name="collectionDate"
                value={form.collectionDate}
                onChange={updateField}
              />
            </label>

            <label className="field">
              <span>Time</span>
              <input
                type="time"
                name="collectionTime"
                value={form.collectionTime}
                onChange={updateField}
              />
            </label>
          </div>
        </div>

        <div className="optional-group">
          <div className="subsection-heading">
            <div>
              <h2>Notes</h2>
              <p>Add anything the group should know.</p>
            </div>
          </div>
          <label className="field">
            <span className="sr-only">Notes</span>
            <textarea
              name="notes"
              value={form.notes}
              onChange={updateField}
              placeholder="Add a note"
              rows="3"
            />
          </label>
          <div className="quick-actions" role="group" aria-labelledby="quick-actions-heading">
            <div className="quick-actions-heading">
              <h3 id="quick-actions-heading">Quick actions</h3>
              <p>Add to notes</p>
            </div>
            <div className="quick-action-buttons">
              {actions.map(({ label, text }) => {
                const added = form.notes.includes(text)

                return (
                  <button
                    className="quick-action"
                    type="button"
                    key={text}
                    title={text}
                    disabled={added}
                    onClick={() => addNote(text)}
                  >
                    {label}
                    {added && <span className="quick-action-added">Added</span>}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </details>
  )
}
