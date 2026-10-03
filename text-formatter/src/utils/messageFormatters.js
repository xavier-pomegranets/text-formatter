function formatCollectionDate(value) {
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))

  return new Intl.DateTimeFormat('en-SG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}

function formatCollectionTime(value) {
  const [hour, minute] = value.split(':').map(Number)
  const time = new Date(Date.UTC(1970, 0, 1, hour, minute))

  return new Intl.DateTimeFormat('en-SG', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'UTC',
  }).format(time)
}

export function buildRouterCaption(router) {
  const routerLine = `${router.model} - ${router.routerId.trim()}${router.includeAccessPoint ? ' + AP' : ''}`
  const mode = router.model === 'SOHO'
    ? ''
    : router.mode === 'Round Robin' ? 'RR' : router.mode
  const lines = [routerLine, [router.provider, mode].filter(Boolean).join(' ')]

  if (router.includeAccessPoint) {
    lines.push(`AP Cloud ID: ${router.accessPointId.trim()}`)
  }

  if (router.location.trim()) {
    lines.push(`Location: ${router.location.trim()}`)
  }

  return lines.join('\n')
}

export function buildEventMessage(form, routers, networks) {
  const isCollectionDone = form.statusUpdate === 'Collection done'
  const updateType = isCollectionDone ? 'Collection' : 'Setup'
  const lines = [`${updateType} completed for Event @ ${form.eventName.trim()}`]

  if (!isCollectionDone && (form.collectionDate || form.collectionTime)) {
    const collectionDateTime = [
      form.collectionDate && formatCollectionDate(form.collectionDate),
      form.collectionTime && formatCollectionTime(form.collectionTime),
    ].filter(Boolean)

    lines.push('', `Collection: ${collectionDateTime.join(', ')}`)
  }

  if (!isCollectionDone) {
    routers.forEach((router, index) => {
      const [routerName, ...routerDetails] = buildRouterCaption(router).split('\n')
      const label = routers.length > 1 ? `Router ${index + 1}` : 'Router'

      lines.push('', `${label}: ${routerName}`, ...routerDetails)
    })

    const completedNetworks = networks.filter(
      (network) => network.ssid.trim() && network.password.trim(),
    )

    completedNetworks.forEach((network, index) => {
      const suffix = completedNetworks.length > 1 ? ` ${index + 1}` : ''
      lines.push(
        '',
        `SSID${suffix}: ${network.ssid.trim()}`,
        `Password${suffix}: ${network.password.trim()}`,
      )
    })
  }

  if (form.notes.trim()) lines.push('', `Notes: ${form.notes.trim()}`)

  return lines.join('\n')
}
