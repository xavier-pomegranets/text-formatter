import { useEffect, useRef, useState } from 'react'
import ImageCropDialog from '../components/ImageCropDialog'
import RouterSection from '../components/RouterSection'
import EventDetails from '../components/EventDetails'
import GeneratedResults from '../components/GeneratedResults'
import {
  getClipboardImageFile,
  getPastedImageName,
} from '../utils/imageClipboard'
import { buildEventMessage, buildRouterCaption } from '../utils/messageFormatters'
import { copyText } from '../utils/clipboard'
import { createCombinedResultImage, normalizeCrop } from '../utils/resultImage'

const initialForm = {
  eventName: '',
  statusUpdate: 'Setup done',
  collectionDate: '',
  collectionTime: '',
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
  location: '',
  speedTestImage: null,
})

const createNetwork = (id) => ({ id, ssid: '', password: '' })

function EventFormatter() {
  const [form, setForm] = useState(initialForm)
  const [routers, setRouters] = useState([createRouter(1)])
  const [networks, setNetworks] = useState([createNetwork(1)])
  const [errors, setErrors] = useState({})
  const [routerErrors, setRouterErrors] = useState({})
  const [networkErrors, setNetworkErrors] = useState({})
  const [output, setOutput] = useState(null)
  const [cropEditorRouterId, setCropEditorRouterId] = useState(null)
  const [imagePasteAnnouncement, setImagePasteAnnouncement] = useState({
    sequence: 0,
    message: '',
  })
  const [copyStatus, setCopyStatus] = useState('idle')
  const [routerResultCopyStatus, setRouterResultCopyStatus] = useState({})
  const nextRouterId = useRef(2)
  const nextNetworkId = useRef(2)
  const formRef = useRef(null)
  const outputRef = useRef(null)
  const cropTriggerRef = useRef(null)
  const imageUrlsRef = useRef(new Set())

  useEffect(() => {
    const imageUrls = imageUrlsRef.current

    return () => {
      imageUrls.forEach((url) => URL.revokeObjectURL(url))
      imageUrls.clear()
    }
  }, [])

  function clearOutput() {
    setOutput(null)
    setCopyStatus('idle')
    setRouterResultCopyStatus({})
  }

  function releaseImage(image) {
    if (!image?.previewUrl) return
    URL.revokeObjectURL(image.previewUrl)
    imageUrlsRef.current.delete(image.previewUrl)
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
      setCropEditorRouterId(null)
    }
    clearOutput()
  }

  function updateRouter(id, field, value) {
    setRouters((current) =>
      current.map((router) =>
        router.id === id
          ? {
              ...router,
              [field]: value,
              ...(field === 'model' && value === 'SOHO'
                ? { mode: 'NA' }
                : field === 'model' && router.model === 'SOHO'
                  ? { mode: 'Round Robin' }
                  : {}),
            }
          : router,
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

  function updateRouterImage(id, file, displayName = file?.name) {
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setRouterErrors((current) => ({
        ...current,
        [id]: {
          ...current[id],
          speedTestImage: 'Choose an image file.',
        },
      }))
      return
    }

    const currentImage = routers.find((router) => router.id === id)?.speedTestImage
    const previewUrl = URL.createObjectURL(file)
    imageUrlsRef.current.add(previewUrl)

    setRouters((current) =>
      current.map((router) =>
        router.id === id
          ? {
              ...router,
              speedTestImage: {
                file,
                name: displayName,
                previewUrl,
                crop: { x: 0, y: 0, width: 1, height: 1 },
              },
            }
          : router,
      ),
    )
    setRouterErrors((current) => ({
      ...current,
      [id]: { ...current[id], speedTestImage: '' },
    }))
    releaseImage(currentImage)
    clearOutput()
  }

  function handleRouterImageChange(id, event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    updateRouterImage(id, file)
  }

  function handleRouterImagePaste(id, event) {
    const clipboardFile = getClipboardImageFile(event.clipboardData)

    if (!clipboardFile) {
      setRouterErrors((current) => ({
        ...current,
        [id]: {
          ...current[id],
          speedTestImage:
            'The clipboard does not contain an image. Copy a screenshot and paste again, or choose a file.',
        },
      }))
      return
    }

    event.preventDefault()
    updateRouterImage(id, clipboardFile, getPastedImageName(clipboardFile))
    setImagePasteAnnouncement((current) => ({
      sequence: current.sequence + 1,
      message: 'Screenshot pasted into the speed-test field.',
    }))
  }

  function removeRouterImage(id) {
    const currentImage = routers.find((router) => router.id === id)?.speedTestImage
    releaseImage(currentImage)
    setRouters((current) =>
      current.map((router) =>
        router.id === id ? { ...router, speedTestImage: null } : router,
      ),
    )
    setRouterErrors((current) => ({
      ...current,
      [id]: { ...current[id], speedTestImage: '' },
    }))
    if (cropEditorRouterId === id) setCropEditorRouterId(null)
    clearOutput()
  }

  function openRouterImageCrop(id, trigger) {
    cropTriggerRef.current = trigger
    setCropEditorRouterId(id)
  }

  function closeRouterImageCrop() {
    setCropEditorRouterId(null)
    window.setTimeout(() => {
      if (cropTriggerRef.current?.isConnected) cropTriggerRef.current.focus()
      cropTriggerRef.current = null
    }, 0)
  }

  function saveRouterImageCrop(id, crop) {
    setRouters((current) =>
      current.map((router) =>
        router.id === id
          ? {
              ...router,
              speedTestImage: router.speedTestImage
                ? { ...router.speedTestImage, crop: normalizeCrop(crop) }
                : null,
            }
          : router,
      ),
    )
    closeRouterImageCrop()
    clearOutput()
  }

  function addRouter() {
    const id = nextRouterId.current
    nextRouterId.current += 1
    setRouters((current) => [...current, createRouter(id)])
    clearOutput()
  }

  function removeRouter(id) {
    const routerToRemove = routers.find((router) => router.id === id)
    releaseImage(routerToRemove?.speedTestImage)
    setRouters((current) => current.filter((router) => router.id !== id))
    setRouterErrors((current) => {
      const next = { ...current }
      delete next[id]
      return next
    })
    if (cropEditorRouterId === id) setCropEditorRouterId(null)
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
          !/^[a-z0-9]{4}$/i.test(router.accessPointId.trim())
        ) {
          currentErrors.accessPointId = 'Enter the last 4 letters or numbers.'
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
        const invalidFields = Array.from(
          document.querySelectorAll('[aria-invalid="true"]'),
        )

        invalidFields.forEach((invalidField) => {
          const containingDetails = invalidField.closest('details')

          if (containingDetails) containingDetails.open = true
        })
        invalidFields[0]?.focus()
      }, 0)
      return
    }

    setOutput({
      eventMessage: buildEventMessage(form, routers, networks),
      routerResults: isCollectionDone
        ? []
        : routers.map((router, index) => ({
            id: router.id,
            label: `Router ${index + 1}`,
            caption: buildRouterCaption(router),
            speedTestImage: router.speedTestImage,
          })),
    })
    setCopyStatus('idle')
    setRouterResultCopyStatus({})
    window.setTimeout(() => {
      outputRef.current?.focus({ preventScroll: true })
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
    setCopyStatus('copying')
    const copied = await copyText(output.eventMessage)

    setCopyStatus(copied ? 'copied' : 'error')
  }

  async function copyRouterResult(routerResult) {
    setRouterResultCopyStatus((current) => ({
      ...current,
      [routerResult.id]: 'copying',
    }))

    if (!routerResult.speedTestImage) {
      const copied = await copyText(routerResult.caption)

      setRouterResultCopyStatus((current) => ({
        ...current,
        [routerResult.id]: copied ? 'copied' : 'error',
      }))
      return
    }

    try {
      if (
        !window.isSecureContext ||
        !navigator.clipboard?.write ||
        !window.ClipboardItem
      ) {
        throw new Error('Image clipboard is not supported by this browser.')
      }

      const pngBlob = createCombinedResultImage(
        routerResult.speedTestImage.file,
        routerResult.caption,
        routerResult.speedTestImage.crop,
      )
      const clipboardItem = new window.ClipboardItem({
        'image/png': pngBlob,
      })

      await navigator.clipboard.write([clipboardItem])
      setRouterResultCopyStatus((current) => ({
        ...current,
        [routerResult.id]: 'copied',
      }))
    } catch {
      setRouterResultCopyStatus((current) => ({
        ...current,
        [routerResult.id]: 'error',
      }))
    }
  }

  async function downloadRouterResult(routerResult) {
    if (!routerResult.speedTestImage) return

    try {
      const blob = await createCombinedResultImage(
        routerResult.speedTestImage.file,
        routerResult.caption,
        routerResult.speedTestImage.crop,
      )
      const downloadUrl = URL.createObjectURL(blob)
      const fileName =
        routerResult.caption
          .split('\n')[0]
          .replace(/[^a-z0-9]+/gi, '-')
          .replace(/^-|-$/g, '') || 'router-result'
      const link = document.createElement('a')

      link.href = downloadUrl
      link.download = `${fileName}.png`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000)
    } catch {
      setRouterResultCopyStatus((current) => ({
        ...current,
        [routerResult.id]: 'error',
      }))
    }
  }

  function resetForm() {
    routers.forEach((router) => releaseImage(router.speedTestImage))
    setForm(initialForm)
    setRouters([createRouter(1)])
    setNetworks([createNetwork(1)])
    nextRouterId.current = 2
    nextNetworkId.current = 2
    setErrors({})
    setRouterErrors({})
    setNetworkErrors({})
    setOutput(null)
    setCropEditorRouterId(null)
    setImagePasteAnnouncement({ sequence: 0, message: '' })
    setCopyStatus('idle')
    setRouterResultCopyStatus({})
    formRef.current?.querySelectorAll('details[open]').forEach((details) => {
      details.open = false
    })
  }

  function addNote(note) {
    setForm((current) => {
      if (current.notes.includes(note)) return current

      const separator = current.notes && !current.notes.endsWith('\n') ? '\n' : ''
      return { ...current, notes: `${current.notes}${separator}${note}` }
    })
    clearOutput()
  }

  const cropEditorRouterIndex = routers.findIndex(
    (router) => router.id === cropEditorRouterId,
  )
  const cropEditorRouter =
    cropEditorRouterIndex >= 0 ? routers[cropEditorRouterIndex] : null

  return (
    <main className="page">
      <header className="page-header">
        <h1>Event Formatter</h1>
        <p>Built for Pomegranets internal usage.</p>
      </header>

      <form
        className="form"
        ref={formRef}
        onSubmit={formatMessage}
        noValidate
      >
        <section className="form-section event-section" aria-label="Event">
          <div className="section-heading">
            <span className="section-step" aria-hidden="true">1</span>
            <h2>Event</h2>
          </div>
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

        <RouterSection
          routers={routers}
          routerErrors={routerErrors}
          isCollectionDone={form.statusUpdate === 'Collection done'}
          updateRouter={updateRouter}
          removeRouter={removeRouter}
          addRouter={addRouter}
          handleRouterImageChange={handleRouterImageChange}
          handleRouterImagePaste={handleRouterImagePaste}
          openRouterImageCrop={openRouterImageCrop}
          removeRouterImage={removeRouterImage}
        />

        <EventDetails
          form={form}
          networks={networks}
          networkErrors={networkErrors}
          updateField={updateField}
          updateNetwork={updateNetwork}
          addNetwork={addNetwork}
          removeNetwork={removeNetwork}
          addNote={addNote}
        />

        <div className="form-actions">
          <button className="clear-button" type="button" onClick={resetForm}>
            Reset
          </button>
          <button className="primary-button" type="submit">
            Generate update
          </button>
        </div>
      </form>

      <GeneratedResults
        output={output}
        outputRef={outputRef}
        routerResultCopyStatus={routerResultCopyStatus}
        copyRouterResult={copyRouterResult}
        downloadRouterResult={downloadRouterResult}
        copyStatus={copyStatus}
        copyOutput={copyOutput}
      />

      <footer className="page-footer">
        For support, contact{' '}
        <a href="mailto:xavier.wong@pomegranets.com">
          xavier.wong@pomegranets.com
        </a>
      </footer>

      {cropEditorRouter?.speedTestImage && (
        <ImageCropDialog
          image={cropEditorRouter.speedTestImage}
          routerLabel={`Router ${cropEditorRouterIndex + 1}`}
          onCancel={closeRouterImageCrop}
          onSave={(crop) => saveRouterImageCrop(cropEditorRouter.id, crop)}
        />
      )}

      <span
        className="sr-only"
        key={`paste-${imagePasteAnnouncement.sequence}`}
        role="status"
        aria-live="polite"
      >
        {imagePasteAnnouncement.message}
      </span>
    </main>
  )
}

export default EventFormatter
