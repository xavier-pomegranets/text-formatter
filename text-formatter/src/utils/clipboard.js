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

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return copyWithFallback(text)
  }
}
