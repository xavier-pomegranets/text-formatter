import { useEffect, useRef } from 'react'

const MAX_CANVAS_EDGE = 1200
const MAX_CANVAS_PIXELS = MAX_CANVAS_EDGE * MAX_CANVAS_EDGE

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value))
}

function normalizedValue(value, fallback) {
  return Number.isFinite(value) ? value : fallback
}

function normalizeCrop(crop) {
  const width = clamp(normalizedValue(crop?.width, 1), 0.03, 1)
  const height = clamp(normalizedValue(crop?.height, 1), 0.03, 1)

  return {
    x: clamp(normalizedValue(crop?.x, 0), 0, 1 - width),
    y: clamp(normalizedValue(crop?.y, 0), 0, 1 - height),
    width,
    height,
  }
}

function CroppedImagePreview({
  image,
  className,
  alt = 'Cropped image preview',
}) {
  const canvasRef = useRef(null)
  const previewUrl = image?.previewUrl
  const cropX = image?.crop?.x
  const cropY = image?.crop?.y
  const cropWidth = image?.crop?.width
  const cropHeight = image?.crop?.height
  const accessibleLabel = alt || 'Cropped image preview'

  useEffect(() => {
    const canvas = canvasRef.current

    if (!canvas) return undefined

    canvas.width = 1
    canvas.height = 1

    if (!previewUrl) return undefined

    const sourceImage = new Image()
    let cancelled = false

    sourceImage.onload = () => {
      if (cancelled || !sourceImage.naturalWidth || !sourceImage.naturalHeight) {
        return
      }

      const crop = normalizeCrop({
        x: cropX,
        y: cropY,
        width: cropWidth,
        height: cropHeight,
      })
      const sourceX = crop.x * sourceImage.naturalWidth
      const sourceY = crop.y * sourceImage.naturalHeight
      const sourceWidth = Math.min(
        crop.width * sourceImage.naturalWidth,
        sourceImage.naturalWidth - sourceX,
      )
      const sourceHeight = Math.min(
        crop.height * sourceImage.naturalHeight,
        sourceImage.naturalHeight - sourceY,
      )

      if (sourceWidth <= 0 || sourceHeight <= 0) return

      const scale = Math.min(
        1,
        MAX_CANVAS_EDGE / sourceWidth,
        MAX_CANVAS_EDGE / sourceHeight,
        Math.sqrt(MAX_CANVAS_PIXELS / (sourceWidth * sourceHeight)),
      )
      const outputWidth = Math.max(1, Math.round(sourceWidth * scale))
      const outputHeight = Math.max(1, Math.round(sourceHeight * scale))

      canvas.width = outputWidth
      canvas.height = outputHeight

      const context = canvas.getContext('2d')

      if (!context) return

      context.imageSmoothingEnabled = true
      context.imageSmoothingQuality = 'high'
      context.drawImage(
        sourceImage,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        0,
        0,
        outputWidth,
        outputHeight,
      )
    }

    sourceImage.src = previewUrl

    return () => {
      cancelled = true
      sourceImage.onload = null
    }
  }, [previewUrl, cropX, cropY, cropWidth, cropHeight])

  return (
    <canvas
      ref={canvasRef}
      className={className}
      width={1}
      height={1}
      role='img'
      aria-label={accessibleLabel}
    >
      {accessibleLabel}
    </canvas>
  )
}

export default CroppedImagePreview
