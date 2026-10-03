import CroppedImagePreview from './CroppedImagePreview'

function getRouterSettingsSummary(router) {
  const parts = [router.provider]

  if (router.model !== 'SOHO') parts.push(router.mode)

  if (router.location.trim()) parts.push(router.location.trim())
  if (router.includeAccessPoint) {
    parts.push(
      router.accessPointId.trim()
        ? `AP ${router.accessPointId.trim()}`
        : 'AP included',
    )
  }

  return parts.join(' \u00b7 ')
}

export default function RouterSection({
  routers,
  routerErrors,
  isCollectionDone,
  updateRouter,
  removeRouter,
  addRouter,
  handleRouterImageChange,
  handleRouterImagePaste,
  openRouterImageCrop,
  removeRouterImage,
}) {
  return (
    <section
      className="form-section"
      hidden={isCollectionDone}
    >
      <div className="section-heading">
        <span className="section-step" aria-hidden="true">2</span>
        <h2>Routers</h2>
      </div>

      <div className="router-list">
        {routers.map((router, index) => (
          <div className="router-block" key={router.id}>
            <div className="router-block-header">
              <strong>Router {index + 1}</strong>
              {routers.length > 1 && (
                <button
                  className="inline-remove"
                  type="button"
                  onClick={() => removeRouter(router.id)}
                  aria-label={`Remove router ${index + 1}`}
                >
                  Remove
                </button>
              )}
            </div>

            <div className="field-grid two-columns router-primary-fields">
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
                  <option>SOHO</option>
                </select>
              </label>

              <label className="field">
                <span>Router ID *</span>
                <div className="router-id-input">
                  <b>{router.model} -</b>
                  <input
                    value={router.routerId}
                    onChange={(event) => updateRouter(router.id, 'routerId', event.target.value)}
                    placeholder="e.g. 5"
                    inputMode="numeric"
                    pattern="[0-9]*"
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

            </div>

            <details className="router-settings">
              <summary
                aria-label={`Router ${index + 1} details: ${getRouterSettingsSummary(router)}`}
              >
                <span>Router {index + 1} details</span>
                <small>{getRouterSettingsSummary(router)}</small>
              </summary>

              <div className="router-settings-content">
                <div className="field-grid two-columns">
                  <label className="field">
                    <span>Mode</span>
                    <select
                      value={router.mode}
                      onChange={(event) =>
                        updateRouter(router.id, 'mode', event.target.value)
                      }
                      aria-label={`Router ${index + 1} mode`}
                      aria-describedby={
                        router.model === 'SOHO'
                          ? `mode-note-${router.id}`
                          : undefined
                      }
                      disabled={router.model === 'SOHO'}
                    >
                      <option>Round Robin</option>
                      <option>Spillover</option>
                      <option>NA</option>
                    </select>
                    {router.model === 'SOHO' && (
                      <small
                        className="field-note"
                        id={`mode-note-${router.id}`}
                      >
                        Mode is not included in SOHO messages.
                      </small>
                    )}
                  </label>

                  <label className="field">
                    <span>Provider</span>
                    <select
                      value={router.provider}
                      onChange={(event) =>
                        updateRouter(
                          router.id,
                          'provider',
                          event.target.value,
                        )
                      }
                      aria-label={`Router ${index + 1} network provider`}
                    >
                      <option>StarHub / Singtel</option>
                      <option>Singtel / StarHub</option>
                      <option>Singtel only</option>
                      <option>StarHub only</option>
                      <option>StarHub (WAN)</option>
                      <option>Singtel (WAN)</option>
                    </select>
                  </label>

                  <label className="field router-location-field">
                    <span>Location</span>
                    <input
                      value={router.location}
                      onChange={(event) =>
                        updateRouter(
                          router.id,
                          'location',
                          event.target.value,
                        )
                      }
                      placeholder="e.g. FOH, beside the stage"
                      aria-label={`Router ${index + 1} location`}
                    />
                  </label>
                </div>

                <div className="ap-row">
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={router.includeAccessPoint}
                      onChange={(event) =>
                        updateRouter(
                          router.id,
                          'includeAccessPoint',
                          event.target.checked,
                        )
                      }
                    />
                    Include access point
                  </label>

                  {router.includeAccessPoint && (
                    <label className="field ap-id">
                      <span>AP Cloud ID *</span>
                      <input
                        value={router.accessPointId}
                        onChange={(event) =>
                          updateRouter(
                            router.id,
                            'accessPointId',
                            event.target.value,
                          )
                        }
                        placeholder="Last 4 characters"
                        maxLength="4"
                        inputMode="text"
                        pattern="[A-Za-z0-9]{4}"
                        autoCapitalize="characters"
                        spellCheck="false"
                        aria-label={`Router ${index + 1} AP Cloud ID`}
                        aria-invalid={Boolean(
                          routerErrors[router.id]?.accessPointId,
                        )}
                        aria-describedby={
                          routerErrors[router.id]?.accessPointId
                            ? `ap-error-${router.id}`
                            : undefined
                        }
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
            </details>

            <div
              className="speed-test-field"
              role="group"
              tabIndex={0}
              aria-labelledby={`speed-test-heading-${router.id}`}
              aria-describedby={[
                `speed-test-paste-help-${router.id}`,
                routerErrors[router.id]?.speedTestImage
                  ? `speed-test-error-${router.id}`
                  : '',
              ]
                .filter(Boolean)
                .join(' ')}
              aria-invalid={Boolean(
                routerErrors[router.id]?.speedTestImage,
              )}
              onPointerDown={(event) => {
                if (
                  !event.target.closest?.('button, label, input')
                ) {
                  event.currentTarget.focus()
                }
              }}
              onPaste={(event) => handleRouterImagePaste(router.id, event)}
            >
              <div className="speed-test-heading">
                <span id={`speed-test-heading-${router.id}`}>
                  Speed-test image
                </span>
                <small id={`speed-test-paste-help-${router.id}`}>
                  Paste with Ctrl/Cmd + V
                </small>
              </div>

              {router.speedTestImage ? (
                <div className="selected-image">
                  <CroppedImagePreview
                    image={router.speedTestImage}
                    alt={`Selected speed-test for router ${index + 1}`}
                  />
                  <div className="selected-image-details">
                    <strong title={router.speedTestImage.name}>
                      {router.speedTestImage.name}
                    </strong>
                    <div className="selected-image-actions">
                      <button
                        className="image-action"
                        type="button"
                        onClick={(event) =>
                          openRouterImageCrop(router.id, event.currentTarget)
                        }
                        aria-label={`Crop or resize speed-test image for router ${index + 1}`}
                      >
                        Crop
                      </button>
                      <label className="image-action">
                        Replace
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(event) =>
                            handleRouterImageChange(router.id, event)
                          }
                          aria-label={`Replace speed-test image for router ${index + 1}`}
                          aria-invalid={Boolean(
                            routerErrors[router.id]?.speedTestImage,
                          )}
                          aria-describedby={
                            routerErrors[router.id]?.speedTestImage
                              ? `speed-test-error-${router.id}`
                              : undefined
                          }
                        />
                      </label>
                      <button
                        className="image-action image-remove"
                        type="button"
                        onClick={() => removeRouterImage(router.id)}
                        aria-label={`Remove speed-test image from router ${index + 1}`}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <label className="image-upload">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) =>
                      handleRouterImageChange(router.id, event)
                    }
                    aria-label={`Choose speed-test image for router ${index + 1}`}
                    aria-invalid={Boolean(
                      routerErrors[router.id]?.speedTestImage,
                    )}
                    aria-describedby={
                      routerErrors[router.id]?.speedTestImage
                        ? `speed-test-error-${router.id}`
                        : `speed-test-help-${router.id}`
                    }
                  />
                  <span>Choose image</span>
                  <small id={`speed-test-help-${router.id}`}>
                    PNG, JPG or WebP
                  </small>
                </label>
              )}

              {routerErrors[router.id]?.speedTestImage && (
                <small
                  className="image-error"
                  id={`speed-test-error-${router.id}`}
                  role="alert"
                >
                  {routerErrors[router.id].speedTestImage}
                </small>
              )}
            </div>
          </div>
        ))}
      </div>

      <button className="text-button add-button" type="button" onClick={addRouter}>
        Add another router
      </button>
    </section>
  )
}
