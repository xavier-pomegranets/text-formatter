import CroppedImagePreview from './CroppedImagePreview'

export default function GeneratedResults({
  output,
  outputRef,
  routerResultCopyStatus,
  copyRouterResult,
  downloadRouterResult,
  copyStatus,
  copyOutput,
}) {
  if (!output) return null

  return (
    <div
      className="generated-results"
      ref={outputRef}
      tabIndex={-1}
      role="region"
      aria-labelledby="generated-results-heading"
    >
      {output.routerResults.length > 0 && (
        <section className="output router-results">
          <div className="output-header router-results-header">
            <h2 id="generated-results-heading">Router results</h2>
            <span>
              {output.routerResults.length}{' '}
              {output.routerResults.length === 1 ? 'router' : 'routers'}
            </span>
          </div>
          <p className="output-help">
            Copy each result and paste it once into WhatsApp. The caption is
            included in the image.
          </p>

          <div className="router-result-list">
            {output.routerResults.map((routerResult) => {
              const resultStatus =
                routerResultCopyStatus[routerResult.id] || 'idle'
              const headingId = `router-result-${routerResult.id}`
              const copyErrorId = `router-result-copy-error-${routerResult.id}`

              return (
                <article
                  className="router-result"
                  key={routerResult.id}
                  aria-labelledby={headingId}
                >
                  <div className="router-result-header">
                    <h3 id={headingId}>{routerResult.label} result</h3>
                    <div className="result-copy-actions">
                      <button
                        className="result-copy-button"
                        type="button"
                        onClick={() => copyRouterResult(routerResult)}
                        disabled={resultStatus === 'copying'}
                        aria-busy={resultStatus === 'copying'}
                        aria-describedby={
                          resultStatus === 'error' ? copyErrorId : undefined
                        }
                        aria-label={
                          routerResult.speedTestImage
                            ? `Copy ${routerResult.label} photo and caption as one image`
                            : `Copy caption for ${routerResult.label}`
                        }
                      >
                        {resultStatus === 'copying'
                          ? 'Copying…'
                          : resultStatus === 'copied'
                            ? 'Copy again'
                            : resultStatus === 'error'
                              ? 'Try again'
                              : routerResult.speedTestImage
                                ? 'Copy result'
                                : 'Copy caption'}
                      </button>
                    </div>
                  </div>

                  {routerResult.speedTestImage ? (
                    <div className="result-image-frame">
                      <CroppedImagePreview
                        image={routerResult.speedTestImage}
                        alt={`Speed-test for ${routerResult.label}`}
                      />
                    </div>
                  ) : (
                    <div className="missing-result-image">
                      No speed-test image attached
                    </div>
                  )}

                  {resultStatus === 'error' && (
                    <p className="result-copy-error" id={copyErrorId}>
                      {routerResult.speedTestImage ? (
                        <>
                          Couldn&apos;t copy this result.{' '}
                          <button
                            className="download-result-button"
                            type="button"
                            onClick={() => downloadRouterResult(routerResult)}
                          >
                            Download the combined image
                          </button>{' '}
                          and attach it in WhatsApp.
                        </>
                      ) : (
                        'Couldn\'t copy this caption. Select the text below and copy it manually.'
                      )}
                    </p>
                  )}

                  {!routerResult.speedTestImage && (
                    <p className="missing-image-help">
                      Add a speed-test image and generate again to create a
                      combined result.
                    </p>
                  )}

                  <pre>{routerResult.caption}</pre>

                  <span className="sr-only" role="status" aria-live="polite">
                    {resultStatus === 'copied'
                      ? routerResult.speedTestImage
                        ? `${routerResult.label} result copied as an image. Paste it into WhatsApp.`
                        : `${routerResult.label} caption copied to clipboard.`
                      : resultStatus === 'error'
                        ? `${routerResult.label} result could not be copied.`
                        : ''}
                  </span>
                </article>
              )
            })}
          </div>
        </section>
      )}

      <section className="output">
        <div className="output-header">
          <h2
            id={
              output.routerResults.length === 0
                ? 'generated-results-heading'
                : undefined
            }
          >
            Event message
          </h2>
          <button
            type="button"
            onClick={copyOutput}
            disabled={copyStatus === 'copying'}
            aria-busy={copyStatus === 'copying'}
          >
            {copyStatus === 'copying'
              ? 'Copying…'
              : copyStatus === 'copied'
                ? 'Copy again'
                : copyStatus === 'error'
                  ? 'Copy failed'
                  : 'Copy message'}
          </button>
        </div>

        <pre>{output.eventMessage}</pre>

        <span className="sr-only" role="status" aria-live="polite">
          {copyStatus === 'copied'
            ? 'Event message copied to clipboard.'
            : copyStatus === 'error'
              ? 'Copy failed. Select and copy the message manually.'
              : ''}
        </span>
      </section>
    </div>
  )
}
