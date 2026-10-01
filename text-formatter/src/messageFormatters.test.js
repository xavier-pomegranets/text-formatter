import assert from 'node:assert/strict'
import test from 'node:test'
import { buildEventMessage, buildRouterCaption } from './messageFormatters.js'

const setupForm = {
  eventName: 'Launch Night',
  statusUpdate: 'Setup done',
  collectionDate: '',
  collectionTime: '',
  notes: '',
}

const router = {
  model: 'E3000',
  routerId: '5',
  mode: 'Round Robin',
  provider: 'StarHub / Singtel',
  includeAccessPoint: false,
  accessPointId: '',
  location: '',
}

test('router captions include a filled location', () => {
  assert.equal(
    buildRouterCaption({
      ...router,
      includeAccessPoint: true,
      accessPointId: 'A1B2',
      location: '  FOH rack  ',
    }),
    [
      'E3000 - 5 + AP',
      'StarHub / Singtel RR',
      'AP Cloud ID: A1B2',
      'Location: FOH rack',
    ].join('\n'),
  )
})

test('router captions omit a blank location', () => {
  assert.equal(
    buildRouterCaption({ ...router, location: '   ' }),
    ['E3000 - 5', 'StarHub / Singtel RR'].join('\n'),
  )
})

test('setup messages include router details and location', () => {
  assert.equal(
    buildEventMessage(
      setupForm,
      [{ ...router, location: 'Control room' }],
      [{ ssid: 'Event Wi-Fi', password: 'secret' }],
    ),
    [
      'Setup completed for Event @ Launch Night',
      '',
      'Router: E3000 - 5',
      'StarHub / Singtel RR',
      'Location: Control room',
      '',
      'SSID: Event Wi-Fi',
      'Password: secret',
    ].join('\n'),
  )
})

test('multiple routers are numbered in setup messages', () => {
  const message = buildEventMessage(
    setupForm,
    [router, { ...router, model: 'SOHO', routerId: '8', mode: 'NA' }],
    [],
  )

  assert.match(message, /Router 1: E3000 - 5/)
  assert.match(message, /Router 2: SOHO - 8/)
})

test('collection messages do not include hidden setup details', () => {
  assert.equal(
    buildEventMessage(
      {
        ...setupForm,
        statusUpdate: 'Collection done',
        notes: 'All equipment returned.',
      },
      [{ ...router, location: 'Control room' }],
      [{ ssid: 'Event Wi-Fi', password: 'secret' }],
    ),
    [
      'Collection completed for Event @ Launch Night',
      '',
      'Notes: All equipment returned.',
    ].join('\n'),
  )
})
