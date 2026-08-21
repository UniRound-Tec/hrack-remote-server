import { renderSVG } from 'uqr'

const app = document.querySelector('#app')
const base = document.querySelector('meta[name="hrack-base"]')?.content ?? ''
const page = document.querySelector('meta[name="hrack-page"]')?.content ?? 'generate'
const roomAvailable =
  document.querySelector('meta[name="hrack-room-available"]')?.content === '1'

let revokeToken = null
let roomId = null

function textElement(tag, className, text) {
  const element = document.createElement(tag)
  element.className = className
  element.textContent = text
  return element
}

function qrElement(value) {
  const wrapper = document.createElement('div')
  wrapper.className = 'qr'
  wrapper.dataset.testid = 'join-qr'
  wrapper.dataset.qrUrl = value
  wrapper.setAttribute('aria-label', 'QR code containing the join URL')
  wrapper.innerHTML = renderSVG(value, {
    pixelSize: 7,
    border: 4,
    whiteColor: '#ffffff',
    blackColor: '#111827'
  })
  return wrapper
}

function actionButton(label, testid) {
  const button = document.createElement('button')
  button.type = 'button'
  button.textContent = label
  button.dataset.testid = testid
  return button
}

function buttonLink(label, href, testid) {
  const link = document.createElement('a')
  link.className = 'button-link'
  link.href = href
  link.textContent = label
  link.dataset.testid = testid
  return link
}

function renderGeneratePage() {
  app.replaceChildren()
  app.append(
    textElement('p', 'eyebrow', 'HRack Remote'),
    textElement('h1', '', 'Pair a private remote-control room'),
    textElement(
      'p',
      'lede',
      'Create a one-desktop, one-phone room. The relay stores no terminal history and the room disappears when the server restarts.'
    )
  )

  const create = actionButton('Create private room', 'create-room')
  const status = textElement('p', 'status', '')
  status.dataset.testid = 'status'
  const result = document.createElement('section')
  result.className = 'result hidden'
  result.dataset.testid = 'room-result'
  app.append(create, status, result)

  create.addEventListener('click', async () => {
    create.disabled = true
    status.textContent = 'Creating…'
    try {
      const response = await fetch(`${base}/v1/rooms`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}'
      })
      if (!response.ok) throw new Error(`create failed (${response.status})`)
      const room = await response.json()
      revokeToken = room.revokeToken
      roomId = room.roomId
      const joinUrl = String(room.joinUrl)
      const link = document.createElement('a')
      link.href = joinUrl
      link.textContent = joinUrl
      link.dataset.testid = 'join-url'
      const copy = actionButton('Copy join URL', 'copy-url')
      const revoke = actionButton('Revoke room', 'revoke-room')
      revoke.className = 'danger'
      const demo = buttonLink(
        'Open browser demo',
        `${base}/demo/${encodeURIComponent(room.roomId)}`,
        'demo-link'
      )
      const actions = document.createElement('div')
      actions.className = 'actions'
      actions.append(demo, copy, revoke)
      result.replaceChildren(
        textElement('h2', '', 'Room ready'),
        qrElement(joinUrl),
        link,
        actions
      )
      result.classList.remove('hidden')
      status.textContent = 'Room created. Keep this page open if you want to revoke it here.'

      copy.addEventListener('click', async () => {
        await navigator.clipboard.writeText(joinUrl)
        status.textContent = 'Join URL copied.'
      })
      revoke.addEventListener('click', async () => {
        if (!revokeToken || !roomId) return
        revoke.disabled = true
        const response = await fetch(`${base}/v1/rooms/${encodeURIComponent(roomId)}`, {
          method: 'DELETE',
          headers: { authorization: `Bearer ${revokeToken}` }
        })
        if (!response.ok) {
          revoke.disabled = false
          status.textContent = 'Could not revoke this room.'
          return
        }
        revokeToken = null
        roomId = null
        status.textContent = 'Room revoked.'
        create.disabled = false
      })
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : 'Could not create a room.'
      create.disabled = false
    }
  })
}

function renderJoinPage() {
  app.replaceChildren(
    textElement('p', 'eyebrow', 'HRack Remote'),
    textElement('h1', '', roomAvailable ? 'Pair this room in HRack' : 'Room unavailable')
  )
  if (!roomAvailable) {
    app.append(
      textElement(
        'p',
        'lede',
        'This room is unknown, revoked, or was cleared by a server restart.'
      )
    )
    return
  }
  const canonical = `${location.origin}${location.pathname.replace(/\/$/, '')}`
  const demoUrl = `${location.origin}${base}/demo/${encodeURIComponent(
    canonical.slice(canonical.lastIndexOf('/') + 1)
  )}`
  app.append(
    textElement(
      'p',
      'lede',
      'Open HRack on the desktop and use this exact URL to pair. To drive it from this browser, open the demo controller below.'
    ),
    qrElement(canonical),
    textElement('p', 'url', canonical),
    buttonLink('Open browser demo', demoUrl, 'demo-link')
  )
}

if (page === 'join') {
  renderJoinPage()
} else if (page === 'demo') {
  void import('./remote-demo.js').then(({ renderRemoteDemo }) => {
    renderRemoteDemo({ app, base, roomAvailable })
  })
} else {
  renderGeneratePage()
}
