export function getClipboardImageFile(clipboardData) {
  const items = Array.from(clipboardData?.items || [])

  for (const item of items) {
    if (
      item.kind === 'file' &&
      item.type.toLowerCase().startsWith('image/')
    ) {
      const file = item.getAsFile()

      if (file) return file
    }
  }

  return (
    Array.from(clipboardData?.files || []).find((file) =>
      file.type.toLowerCase().startsWith('image/'),
    ) || null
  )
}

export function getPastedImageName(file) {
  const subtype = file?.type.toLowerCase().split('/')[1]?.split(/[+;]/)[0]
  const extension =
    subtype === 'jpeg'
      ? 'jpg'
      : /^[a-z0-9]+$/.test(subtype || '')
        ? subtype
        : 'png'

  return `Pasted screenshot.${extension}`
}
