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

export function normalizeCrop(crop) {
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

export function createCombinedResultImage(file, caption, crop) {
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
