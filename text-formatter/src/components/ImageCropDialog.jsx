import { useEffect, useRef, useState } from 'react'

const MIN_CROP_SIZE = 0.03
const MIN_CROP_PIXELS = 44
const DEFAULT_MINIMUM_CROP = {
  width: MIN_CROP_SIZE,
  height: MIN_CROP_SIZE,
}
const HANDLE_LABELS = {
  n: 'Resize from top edge',
  ne: 'Resize from top right corner',
  e: 'Resize from right edge',
  se: 'Resize from bottom right corner',
  s: 'Resize from bottom edge',
  sw: 'Resize from bottom left corner',
  w: 'Resize from left edge',
  nw: 'Resize from top left corner',
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value))
}

function getMinimumCrop(stageWidth, stageHeight) {
  return {
    width: Math.min(
      1,
      Math.max(MIN_CROP_SIZE, MIN_CROP_PIXELS / stageWidth),
    ),
    height: Math.min(
      1,
      Math.max(MIN_CROP_SIZE, MIN_CROP_PIXELS / stageHeight),
    ),
  }
}

function normalizeCrop(value, minimumCrop = DEFAULT_MINIMUM_CROP) {
  const source = value && typeof value === 'object' ? value : {}
  const width = clamp(
    Number.isFinite(source.width) ? source.width : 1,
    minimumCrop.width,
    1,
  )
  const height = clamp(
    Number.isFinite(source.height) ? source.height : 1,
    minimumCrop.height,
    1,
  )

  return {
    x: clamp(Number.isFinite(source.x) ? source.x : 0, 0, 1 - width),
    y: clamp(Number.isFinite(source.y) ? source.y : 0, 0, 1 - height),
    width,
    height,
  }
}

function resizeCrop(
  crop,
  handle,
  deltaX,
  deltaY,
  minimumCrop = DEFAULT_MINIMUM_CROP,
) {
  let left = crop.x
  let right = crop.x + crop.width
  let top = crop.y
  let bottom = crop.y + crop.height

  if (handle.includes('w')) {
    left = clamp(crop.x + deltaX, 0, right - minimumCrop.width)
  }
  if (handle.includes('e')) {
    right = clamp(
      crop.x + crop.width + deltaX,
      left + minimumCrop.width,
      1,
    )
  }
  if (handle.includes('n')) {
    top = clamp(crop.y + deltaY, 0, bottom - minimumCrop.height)
  }
  if (handle.includes('s')) {
    bottom = clamp(
      crop.y + crop.height + deltaY,
      top + minimumCrop.height,
      1,
    )
  }

  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  }
}

function roundCrop(crop) {
  return Object.fromEntries(
    Object.entries(crop).map(([key, value]) => [key, Number(value.toFixed(6))]),
  )
}

function ImageCropDialog({ image, routerLabel, onCancel, onSave }) {
  const [crop, setCrop] = useState(() => normalizeCrop(image?.crop))
  const [naturalSize, setNaturalSize] = useState(null)
  const [stageSize, setStageSize] = useState(null)
  const dialogRef = useRef(null)
  const stageRef = useRef(null)
  const cropRef = useRef(crop)
  const dragRef = useRef(null)
  const minimumCropRef = useRef(DEFAULT_MINIMUM_CROP)
  const label = routerLabel?.trim() || 'router'

  function commitCrop(nextCrop, minimumCrop = minimumCropRef.current) {
    const normalized = normalizeCrop(nextCrop, minimumCrop)
    cropRef.current = normalized
    setCrop(normalized)
  }

  useEffect(() => {
    const previouslyFocused = document.activeElement
    const previousOverflow = document.body.style.overflow

    document.body.style.overflow = 'hidden'
    dialogRef.current?.focus()

    return () => {
      document.body.style.overflow = previousOverflow
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus()
    }
  }, [])

  useEffect(() => {
    function handleEscape(event) {
      if (event.key === 'Escape') onCancel()
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onCancel])

  useEffect(() => {
    const stage = stageRef.current
    const workspace = stage?.parentElement

    if (!workspace || !naturalSize) return undefined

    function fitStageToWorkspace() {
      const workspaceStyles = window.getComputedStyle(workspace)
      const horizontalPadding =
        Number.parseFloat(workspaceStyles.paddingLeft) +
        Number.parseFloat(workspaceStyles.paddingRight)
      const availableWidth = Math.max(
        1,
        workspace.clientWidth - horizontalPadding,
      )
      const viewportHeight = window.visualViewport?.height || window.innerHeight
      const heightRatio = window.matchMedia('(max-width: 620px)').matches
        ? 0.46
        : 0.52
      const availableHeight = Math.max(1, viewportHeight * heightRatio)
      const scale = Math.min(
        1,
        availableWidth / naturalSize.width,
        availableHeight / naturalSize.height,
      )
      const nextSize = {
        width: Math.max(1, naturalSize.width * scale),
        height: Math.max(1, naturalSize.height * scale),
      }
      const nextMinimumCrop = getMinimumCrop(nextSize.width, nextSize.height)

      minimumCropRef.current = nextMinimumCrop
      commitCrop(cropRef.current, nextMinimumCrop)

      setStageSize((current) =>
        current &&
        Math.abs(current.width - nextSize.width) < 0.5 &&
        Math.abs(current.height - nextSize.height) < 0.5
          ? current
          : nextSize,
      )
    }

    fitStageToWorkspace()

    const resizeObserver = new ResizeObserver(fitStageToWorkspace)
    resizeObserver.observe(workspace)
    window.addEventListener('resize', fitStageToWorkspace)
    window.visualViewport?.addEventListener('resize', fitStageToWorkspace)

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', fitStageToWorkspace)
      window.visualViewport?.removeEventListener('resize', fitStageToWorkspace)
    }
  }, [naturalSize])

  function startDrag(event, action) {
    if (event.pointerType === 'mouse' && event.button !== 0) return

    const stage = stageRef.current
    const bounds = stage?.getBoundingClientRect()

    if (!stage || !bounds?.width || !bounds.height) return

    event.preventDefault()
    event.stopPropagation()
    stage.setPointerCapture(event.pointerId)
    dragRef.current = {
      action,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startCrop: cropRef.current,
      stageWidth: bounds.width,
      stageHeight: bounds.height,
      minimumCrop: getMinimumCrop(bounds.width, bounds.height),
    }
  }

  function handlePointerMove(event) {
    const drag = dragRef.current

    if (!drag || drag.pointerId !== event.pointerId) return

    event.preventDefault()
    const deltaX = (event.clientX - drag.startClientX) / drag.stageWidth
    const deltaY = (event.clientY - drag.startClientY) / drag.stageHeight

    if (drag.action === 'move') {
      commitCrop({
        ...drag.startCrop,
        x: clamp(
          drag.startCrop.x + deltaX,
          0,
          1 - drag.startCrop.width,
        ),
        y: clamp(
          drag.startCrop.y + deltaY,
          0,
          1 - drag.startCrop.height,
        ),
      })
      return
    }

    commitCrop(
      resizeCrop(
        drag.startCrop,
        drag.action,
        deltaX,
        deltaY,
        drag.minimumCrop,
      ),
      drag.minimumCrop,
    )
  }

  function finishDrag(event) {
    if (dragRef.current?.pointerId !== event.pointerId) return

    dragRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  function getKeyboardDelta(event) {
    const step = event.shiftKey ? 0.05 : 0.01

    if (event.key === 'ArrowLeft') return { x: -step, y: 0 }
    if (event.key === 'ArrowRight') return { x: step, y: 0 }
    if (event.key === 'ArrowUp') return { x: 0, y: -step }
    if (event.key === 'ArrowDown') return { x: 0, y: step }
    return null
  }

  function handleSelectionKeyDown(event) {
    const delta = getKeyboardDelta(event)

    if (!delta) return

    event.preventDefault()
    const current = cropRef.current
    commitCrop({
      ...current,
      x: clamp(current.x + delta.x, 0, 1 - current.width),
      y: clamp(current.y + delta.y, 0, 1 - current.height),
    })
  }

  function handleResizeKeyDown(event, handle) {
    const delta = getKeyboardDelta(event)

    if (!delta) return

    event.stopPropagation()

    const usesHorizontalKey = delta.x && /[ew]/.test(handle)
    const usesVerticalKey = delta.y && /[ns]/.test(handle)

    if (!usesHorizontalKey && !usesVerticalKey) return

    event.preventDefault()
    const bounds = stageRef.current?.getBoundingClientRect()
    const minimumCrop = bounds?.width && bounds.height
      ? getMinimumCrop(bounds.width, bounds.height)
      : minimumCropRef.current

    commitCrop(
      resizeCrop(
        cropRef.current,
        handle,
        delta.x || 0,
        delta.y || 0,
        minimumCrop,
      ),
      minimumCrop,
    )
  }

  function handleDialogKeyDown(event) {
    if (event.key !== 'Tab') return

    const focusable = Array.from(
      dialogRef.current?.querySelectorAll('button:not([disabled]), [tabindex="0"]') || [],
    )

    if (!focusable.length) {
      event.preventDefault()
      return
    }

    const first = focusable[0]
    const last = focusable[focusable.length - 1]

    if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  function handleBackdropClick(event) {
    if (event.target === event.currentTarget) onCancel()
  }

  function resetCrop() {
    commitCrop({ x: 0, y: 0, width: 1, height: 1 })
  }

  function applyCrop() {
    onSave(roundCrop(normalizeCrop(cropRef.current, minimumCropRef.current)))
  }

  const percentageCrop = {
    left: `${crop.x * 100}%`,
    top: `${crop.y * 100}%`,
    width: `${crop.width * 100}%`,
    height: `${crop.height * 100}%`,
  }

  return (
    <div
      className="crop-overlay"
      onClick={handleBackdropClick}
      role="presentation"
    >
      <section
        className="crop-dialog"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="crop-dialog-title"
        aria-describedby="crop-dialog-instructions"
        tabIndex={-1}
        onKeyDown={handleDialogKeyDown}
      >
        <div className="crop-header">
          <div className="crop-heading">
            <h2 id="crop-dialog-title">Crop photo</h2>
            <p>{label}</p>
          </div>
          <button
            className="crop-close"
            type="button"
            onClick={onCancel}
            aria-label="Close crop dialog"
          >
            <span aria-hidden="true">&times;</span>
          </button>
        </div>

        <p className="crop-instructions" id="crop-dialog-instructions">
          Drag the frame or its handles. Use arrow keys for precise adjustments;
          hold Shift for larger steps.
        </p>

        <div className="crop-workspace" aria-busy={!stageSize}>
          {!stageSize && (
            <span className="crop-loading" role="status">
              Preparing photo...
            </span>
          )}
          <div
            className="crop-stage"
            ref={stageRef}
            style={{
              touchAction: 'none',
              ...(stageSize
                ? {
                    width: `${stageSize.width}px`,
                    height: `${stageSize.height}px`,
                  }
                : { width: '1px', height: '1px', visibility: 'hidden' }),
            }}
            onPointerMove={handlePointerMove}
            onPointerUp={finishDrag}
            onPointerCancel={finishDrag}
          >
            <img
              className="crop-image"
              src={image?.previewUrl}
              alt={`Photo to crop for ${label}`}
              draggable="false"
              onLoad={(event) => {
                const { naturalWidth, naturalHeight } = event.currentTarget

                if (naturalWidth && naturalHeight) {
                  setNaturalSize({ width: naturalWidth, height: naturalHeight })
                }
              }}
            />
            <div className="crop-shade crop-shade-top" style={{ height: percentageCrop.top }} />
            <div
              className="crop-shade crop-shade-right"
              style={{
                left: `calc(${percentageCrop.left} + ${percentageCrop.width})`,
                top: percentageCrop.top,
                width: `calc(100% - ${percentageCrop.left} - ${percentageCrop.width})`,
                height: percentageCrop.height,
              }}
            />
            <div
              className="crop-shade crop-shade-bottom"
              style={{
                top: `calc(${percentageCrop.top} + ${percentageCrop.height})`,
                height: `calc(100% - ${percentageCrop.top} - ${percentageCrop.height})`,
              }}
            />
            <div
              className="crop-shade crop-shade-left"
              style={{
                top: percentageCrop.top,
                width: percentageCrop.left,
                height: percentageCrop.height,
              }}
            />

            <div
              className="crop-selection"
              style={percentageCrop}
              tabIndex={0}
              role="group"
              aria-label="Crop selection. Use arrow keys to move it."
              onPointerDown={(event) => startDrag(event, 'move')}
              onKeyDown={handleSelectionKeyDown}
            >
              <span className="crop-grid crop-grid-vertical-one" aria-hidden="true" />
              <span className="crop-grid crop-grid-vertical-two" aria-hidden="true" />
              <span className="crop-grid crop-grid-horizontal-one" aria-hidden="true" />
              <span className="crop-grid crop-grid-horizontal-two" aria-hidden="true" />

              {Object.entries(HANDLE_LABELS).map(([handle, handleLabel]) => (
                <button
                  className={`crop-handle crop-handle-${handle}`}
                  key={handle}
                  type="button"
                  aria-label={`${handleLabel}. Use arrow keys to resize.`}
                  onPointerDown={(event) => startDrag(event, handle)}
                  onKeyDown={(event) => handleResizeKeyDown(event, handle)}
                />
              ))}
            </div>
          </div>
        </div>

        <p className="crop-readout" role="status" aria-live="polite">
          Position: {Math.round(crop.x * 100)}% from left,{' '}
          {Math.round(crop.y * 100)}% from top. Size:{' '}
          {Math.round(crop.width * 100)}% wide by{' '}
          {Math.round(crop.height * 100)}% high.
        </p>

        <div className="crop-actions">
          <button className="crop-reset" type="button" onClick={resetCrop}>
            Reset
          </button>
          <div className="crop-action-group">
            <button className="crop-cancel" type="button" onClick={onCancel}>
              Cancel
            </button>
            <button className="crop-apply" type="button" onClick={applyCrop}>
              Apply crop
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}

export default ImageCropDialog
