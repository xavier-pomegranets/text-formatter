import { useEffect, useRef, useState } from 'react'
import './App.css'
import CroppedImagePreview from './CroppedImagePreview'
import ImageCropDialog from './ImageCropDialog'
import { buildEventMessage, buildRouterCaption } from './messageFormatters'

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

function wrapCanvasText(context, text, maxWidth) {
  const wrappedLines = []

  text.split('\n').forEach((paragraph) => {
    const words = paragraph
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .flatMap((word) => {
        if (context.measureText(word).width <= maxWidth) return [word]

        const parts = []
        let part = ''

        Array.from(word).forEach((character) => {
          const nextPart = `${part}${character}`

          if (part && context.measureText(nextPart).width > maxWidth) {
            parts.push(part)
            part = character
          } else {
            part = nextPart
          }
        })

        if (part) parts.push(part)
        return parts
      })

    if (!words.length) {
      wrappedLines.push('')
      return
    }

    let currentLine = words[0]

    words.slice(1).forEach((word) => {
      const nextLine = `${currentLine} ${word}`

      if (context.measureText(nextLine).width <= maxWidth) {
        currentLine = nextLine
      } else {
        wrappedLines.push(currentLine)
        currentLine = word
      }
    })

    wrappedLines.push(currentLine)
  })

  return wrappedLines
}

function normalizeCrop(crop) {
  const width = Number.isFinite(crop?.width)
    ? Math.min(1, Math.max(0.03, crop.width))
    : 1
  const height = Number.isFinite(crop?.height)
    ? Math.min(1, Math.max(0.03, crop.height))
    : 1
  const x = Number.isFinite(crop?.x)
    ? Math.min(1 - width, Math.max(0, crop.x))
    : 0
  const y = Number.isFinite(crop?.y)
    ? Math.min(1 - height, Math.max(0, crop.y))
    : 0

  return { x, y, width, height }
}

function createCombinedResultImage(file, caption, crop) {
  return new Promise((resolve, reject) => {
    const imageUrl = URL.createObjectURL(file)
    const image = new Image()

    function cleanup() {
      URL.revokeObjectURL(imageUrl)
    }

    image.onload = () => {
      try {
        const naturalWidth = image.naturalWidth
        const naturalHeight = image.naturalHeight

        if (!naturalWidth || !naturalHeight) {
          cleanup()
          reject(new Error('The result image could not be prepared.'))
          return
        }

        const normalizedCrop = normalizeCrop(crop)
        const sourceX = Math.min(
          naturalWidth - 1,
          Math.max(0, Math.round(normalizedCrop.x * naturalWidth)),
        )
        const sourceY = Math.min(
          naturalHeight - 1,
          Math.max(0, Math.round(normalizedCrop.y * naturalHeight)),
        )
        const sourceWidth = Math.max(
          1,
          Math.min(
            naturalWidth - sourceX,
            Math.round(normalizedCrop.width * naturalWidth),
          ),
        )
        const sourceHeight = Math.max(
          1,
          Math.min(
            naturalHeight - sourceY,
            Math.round(normalizedCrop.height * naturalHeight),
          ),
        )
        const scale = Math.min(
          1,
          2048 / sourceWidth,
          4096 / sourceHeight,
          Math.sqrt(12_000_000 / (sourceWidth * sourceHeight)),
        )
        const imageWidth = Math.max(1, Math.round(sourceWidth * scale))
        const imageHeight = Math.max(1, Math.round(sourceHeight * scale))
        const padding = Math.max(12, Math.min(64, Math.round(imageWidth * 0.025)))
        const fontSize = Math.max(14, Math.min(56, Math.round(imageWidth * 0.03)))
        const lineHeight = Math.round(fontSize * 1.45)
        const measurementCanvas = document.createElement('canvas')
        const measurementContext = measurementCanvas.getContext('2d')

        if (!measurementContext || !imageWidth || !imageHeight) {
          cleanup()
          reject(new Error('The result image could not be prepared.'))
          return
        }

        measurementContext.font = `600 ${fontSize}px ui-monospace, SFMono-Regular, Consolas, monospace`
        const captionLines = wrapCanvasText(
          measurementContext,
          caption,
          Math.max(1, imageWidth - padding * 2),
        )
        const captionHeight = padding * 2 + captionLines.length * lineHeight
        const canvas = document.createElement('canvas')
        canvas.width = imageWidth
        canvas.height = imageHeight + captionHeight
        const context = canvas.getContext('2d')

        if (!context || !canvas.width || !canvas.height) {
          cleanup()
          reject(new Error('The result image could not be prepared.'))
          return
        }

        context.fillStyle = '#ffffff'
        context.fillRect(0, 0, canvas.width, canvas.height)
        context.imageSmoothingEnabled = true
        context.imageSmoothingQuality = 'high'
        context.drawImage(
          image,
          sourceX,
          sourceY,
          sourceWidth,
          sourceHeight,
          0,
          0,
          imageWidth,
          imageHeight,
        )
        context.fillStyle = '#f7f7f5'
        context.fillRect(0, imageHeight, imageWidth, captionHeight)
        context.fillStyle = '#dedfd9'
        context.fillRect(0, imageHeight, imageWidth, Math.max(1, imageWidth / 1000))
        context.fillStyle = '#20241f'
        context.font = `600 ${fontSize}px ui-monospace, SFMono-Regular, Consolas, monospace`
        context.textBaseline = 'top'

        captionLines.forEach((line, index) => {
          context.fillText(
            line,
            padding,
            imageHeight + padding + index * lineHeight,
          )
        })

        canvas.toBlob((blob) => {
          cleanup()

          if (blob) {
            resolve(blob)
          } else {
            reject(new Error('The result image could not be prepared.'))
          }
        }, 'image/png')
      } catch (error) {
        cleanup()
        reject(error)
      }
    }

    image.onerror = () => {
      cleanup()
      reject(new Error('The speed-test image could not be loaded.'))
    }

    image.src = imageUrl
  })
}

function App() {
  const [form, setForm] = useState(initialForm)
  const [routers, setRouters] = useState([createRouter(1)])
  const [networks, setNetworks] = useState([createNetwork(1)])
  const [errors, setErrors] = useState({})
  const [routerErrors, setRouterErrors] = useState({})
  const [networkErrors, setNetworkErrors] = useState({})
  const [output, setOutput] = useState(null)
  const [cropEditorRouterId, setCropEditorRouterId] = useState(null)
  const [copyStatus, setCopyStatus] = useState('idle')
  const [routerResultCopyStatus, setRouterResultCopyStatus] = useState({})
  const nextRouterId = useRef(2)
  const nextNetworkId = useRef(2)
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

  function updateRouterImage(id, file) {
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
                name: file.name,
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
        document.querySelector('[aria-invalid="true"]')?.focus()
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

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      return copyWithFallback(text)
    }
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
    setCopyStatus('idle')
    setRouterResultCopyStatus({})
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

  const cropEditorRouterIndex = routers.findIndex(
    (router) => router.id === cropEditorRouterId,
  )
  const cropEditorRouter =
    cropEditorRouterIndex >= 0 ? routers[cropEditorRouterIndex] : null

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
          <h2>Routers</h2>

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
                      <option>SOHO</option>
                    </select>
                  </label>

                  <label className="field">
                    <span>ID *</span>
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

                  <label className="field">
                    <span>Mode</span>
                    <select
                      value={router.mode}
                      onChange={(event) => updateRouter(router.id, 'mode', event.target.value)}
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
                      <small className="field-note" id={`mode-note-${router.id}`}>
                        SOHO mode is fixed to NA.
                      </small>
                    )}
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
                      <option>StarHub (WAN)</option>
                      <option>Singtel (WAN)</option>
                    </select>
                  </label>

                  <label className="field router-location-field">
                    <span>Location</span>
                    <input
                      value={router.location}
                      onChange={(event) =>
                        updateRouter(router.id, 'location', event.target.value)
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
                        placeholder="Last 4 characters"
                        maxLength="4"
                        inputMode="text"
                        pattern="[A-Za-z0-9]{4}"
                        autoCapitalize="characters"
                        spellCheck="false"
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

                <div className="speed-test-field">
                  <div className="speed-test-heading">
                    <span>Speed-test image</span>
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
                            Crop / resize
                          </button>
                          <label className="image-action">
                            Replace image
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
                            Remove image
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
                        PNG, JPG, WebP, or another image format
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
            + Add router
          </button>
        </section>

        <section
          className="form-section"
          hidden={form.statusUpdate === 'Collection done'}
        >
          <h2>Wi-Fi</h2>

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
            + Add Wi-Fi
          </button>
        </section>

        <section
          className="form-section"
          hidden={form.statusUpdate === 'Collection done'}
        >
          <h2>Collection</h2>
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
      )}

      {cropEditorRouter?.speedTestImage && (
        <ImageCropDialog
          image={cropEditorRouter.speedTestImage}
          routerLabel={`Router ${cropEditorRouterIndex + 1}`}
          onCancel={closeRouterImageCrop}
          onSave={(crop) => saveRouterImageCrop(cropEditorRouter.id, crop)}
        />
      )}
    </main>
  )
}

export default App
