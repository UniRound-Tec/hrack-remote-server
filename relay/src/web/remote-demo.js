import { FitAddon } from '@xterm/addon-fit'
import { Terminal } from '@xterm/xterm'
import '@xterm/xterm/css/xterm.css'
import './remote-demo.css'

import {
  parseJoinUrl,
  parseRemoteFrame
} from '../protocol/remote-protocol.ts'
import { createRendererController } from './xterm-renderer.js'

function element(tag, className, text) {
  const node = document.createElement(tag)
  node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

function button(label, testid, className = '') {
  const node = element('button', className, label)
  node.type = 'button'
  node.dataset.testid = testid
  return node
}

function bytesFromBase64(value) {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

function friendlyStatus(status) {
  return {
    working: 'Working',
    'needs-you': 'Needs you',
    done: 'Done',
    error: 'Error',
    idle: 'Idle',
    exited: 'Exited'
  }[status] ?? status
}

function requestId() {
  return globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

const HRACK_TERMINAL_FONT =
  '"Maple Mono", "Microsoft JhengHei UI", "Microsoft YaHei UI", "PingFang TC", "PingFang SC", "Noto Sans Mono CJK TC", "Noto Sans Mono CJK SC", "Noto Sans CJK TC", "Noto Sans CJK SC", Consolas, monospace'

const HRACK_DARK_TERMINAL_THEME = {
  background: '#1f1f1f',
  foreground: '#c8d3e0',
  cursor: '#c8d3e0',
  cursorAccent: '#1f1f1f',
  selectionBackground: '#3d4f6b',
  black: '#1b1d23',
  red: '#e06c75',
  green: '#98c379',
  yellow: '#e5c07b',
  blue: '#61afef',
  magenta: '#c678dd',
  cyan: '#56b6c2',
  white: '#abb2bf',
  brightBlack: '#5c6370',
  brightRed: '#e06c75',
  brightGreen: '#98c379',
  brightYellow: '#e5c07b',
  brightBlue: '#61afef',
  brightMagenta: '#c678dd',
  brightCyan: '#56b6c2',
  brightWhite: '#ffffff'
}

export async function renderRemoteDemo({ app, base, roomAvailable }) {
  try {
    await Promise.all([
      document.fonts.load('400 14px "Maple Mono"'),
      document.fonts.load('700 14px "Maple Mono"')
    ])
  } catch {
    // A blocked font must not strand the controller on a blank page. The
    // browser gate still detects this fallback so deployment cannot miss it.
  }
  document.title = 'Browser controller · HRack Remote'
  app.classList.add('demo-shell')
  app.replaceChildren()

  const prefix = `${base}/demo/`
  const encodedRoom = location.pathname.startsWith(prefix)
    ? location.pathname.slice(prefix.length)
    : ''
  let routeRoomId = ''
  try {
    routeRoomId = encodedRoom && !encodedRoom.includes('/')
      ? decodeURIComponent(encodedRoom)
      : ''
  } catch {
    routeRoomId = ''
  }

  const root = element('div', 'demo-page')
  root.dataset.testid = 'demo-page'
  const header = element('header', 'demo-header')
  header.append(
    element('p', 'eyebrow', 'HRack Remote · P4 demo'),
    element('h1', '', 'Browser controller'),
    element(
      'p',
      'lede',
      'Connect to a paired desktop, choose a live session, and drive its real terminal from this page.'
    )
  )

  const connectPanel = element('section', 'connect-panel panel')
  const field = element('label', 'field')
  field.append(element('span', '', 'Private join URL'))
  const joinInput = element('input', 'join-input')
  joinInput.type = 'url'
  joinInput.autocomplete = 'off'
  joinInput.autocapitalize = 'none'
  joinInput.spellcheck = false
  joinInput.placeholder = `${location.origin}${base}/your-room-id`
  joinInput.dataset.testid = 'demo-url'
  if (routeRoomId) {
    joinInput.value = `${location.origin}${base}/${encodeURIComponent(routeRoomId)}`
    joinInput.readOnly = true
  }
  field.append(joinInput)

  const connect = button('Connect', 'demo-connect')
  const disconnect = button('Disconnect', 'demo-disconnect', 'secondary')
  disconnect.disabled = true
  const connectActions = element('div', 'actions')
  connectActions.append(connect, disconnect)
  const status = element('p', 'status', 'Not connected.')
  status.dataset.testid = 'demo-status'
  status.dataset.phase = 'disconnected'
  connectPanel.append(field, connectActions, status)

  const sessionsView = element('section', 'panel sessions-view')
  sessionsView.dataset.testid = 'demo-session-list'
  sessionsView.append(
    element('h2', '', 'Live sessions'),
    element('p', 'muted session-empty', 'Connect to load sessions from the desktop.')
  )

  const terminalView = element('section', 'terminal-view hidden')
  terminalView.dataset.testid = 'demo-terminal-view'
  const terminalToolbar = element('div', 'terminal-toolbar')
  const terminalTitle = element('div', 'terminal-title', 'Remote terminal')
  const returnButton = button('Back to sessions', 'demo-return', 'secondary')
  terminalToolbar.append(terminalTitle, returnButton)
  const terminalHost = element('div', 'terminal-host')
  terminalHost.dataset.renderedPtyBytes = '0'
  const keybar = element('div', 'keybar')
  const keys = [
    ['Esc', '\u001b'],
    ['Ctrl+C', '\u0003'],
    ['Tab', '\t'],
    ['←', '\u001b[D'],
    ['↑', '\u001b[A'],
    ['↓', '\u001b[B'],
    ['→', '\u001b[C']
  ]
  for (const [label, data] of keys) {
    const key = button(label, 'demo-key', 'key-button')
    key.addEventListener('click', () => sendInput(data))
    keybar.append(key)
  }
  terminalView.append(terminalToolbar, terminalHost, keybar)
  root.append(header, connectPanel, sessionsView, terminalView)
  app.append(root)

  const terminal = new Terminal({
    allowProposedApi: true,
    allowTransparency: true,
    cursorBlink: true,
    fontFamily: HRACK_TERMINAL_FONT,
    fontSize: 14,
    reflowCursorLine: true,
    scrollback: 5_000,
    smoothScrollDuration: 80,
    theme: HRACK_DARK_TERMINAL_THEME
  })
  const fit = new FitAddon()
  terminal.loadAddon(fit)
  terminal.open(terminalHost)
  const renderer = createRendererController(terminal, (kind) => {
    terminalHost.dataset.renderer = kind
  })
  terminalHost.dataset.renderer = 'dom'
  requestAnimationFrame(() => {
    void renderer.activate().finally(() => {
      terminalHost.dataset.rendererAttempted = '1'
    })
  })

  let socket = null
  let connectedRoomId = null
  let desktopOnline = false
  let pendingDrive = null
  let activeSessionId = null
  let fitting = false
  let closedByUser = false
  let renderedPtyBytes = 0
  const sessions = new Map()

  function setStatus(phase, message) {
    status.dataset.phase = phase
    status.textContent = message
  }

  function canSend() {
    return socket?.readyState === WebSocket.OPEN
  }

  function send(message) {
    if (!canSend()) return false
    socket.send(JSON.stringify(message))
    return true
  }

  function dimensions() {
    if (!terminalView.classList.contains('hidden')) {
      try {
        fitting = true
        fit.fit()
      } finally {
        fitting = false
      }
    }
    return {
      cols: Math.max(1, Math.min(10_000, terminal.cols || 80)),
      rows: Math.max(1, Math.min(10_000, terminal.rows || 24))
    }
  }

  function showSessions() {
    terminalView.classList.add('hidden')
    sessionsView.classList.remove('hidden')
    pendingDrive = null
    activeSessionId = null
    renderSessions()
  }

  function renderSessions() {
    sessionsView.replaceChildren(element('h2', '', 'Live sessions'))
    if (!desktopOnline) {
      sessionsView.append(
        element('p', 'muted session-empty', 'Waiting for the paired desktop to come online…')
      )
      return
    }
    const items = [...sessions.values()].sort(
      (left, right) => right.lastActivityAt - left.lastActivityAt
    )
    if (items.length === 0) {
      sessionsView.append(
        element('p', 'muted session-empty', 'The desktop is online, but it has no live sessions yet.')
      )
      return
    }
    const grid = element('div', 'session-grid')
    for (const session of items) {
      const item = button('', 'demo-session', 'session-card')
      item.disabled = session.status === 'exited' || pendingDrive !== null
      const top = element('span', 'session-card-top')
      top.append(
        element('strong', '', session.name),
        element('span', `session-state state-${session.status}`, friendlyStatus(session.status))
      )
      item.append(top)
      if (session.workspace) item.append(element('span', 'session-workspace', session.workspace))
      if (session.detail) item.append(element('span', 'session-detail', session.detail))
      item.addEventListener('click', () => drive(session))
      grid.append(item)
    }
    sessionsView.append(grid)
  }

  function drive(session) {
    if (!canSend() || pendingDrive || activeSessionId) return
    const id = requestId()
    pendingDrive = { requestId: id, sessionId: session.sessionId }
    renderSessions()
    const { cols, rows } = dimensions()
    send({
      v: 1,
      type: 'drive',
      requestId: id,
      sessionId: session.sessionId,
      cols,
      rows
    })
    setStatus('drive-requested', `Opening ${session.name}…`)
  }

  function sendInput(data) {
    if (!activeSessionId) return
    send({ v: 1, type: 'pty-in', sessionId: activeSessionId, data })
    terminal.focus()
  }

  async function replay(history) {
    if (!history.complete) {
      terminal.writeln(
        `\r\n\x1b[33m[Earlier output was truncated: ${history.droppedOutputBytes} bytes]\x1b[0m`
      )
    }
    const events = [...history.events].sort((left, right) => left.sequence - right.sequence)
    for (const event of events) {
      if (event.kind === 'resize') {
        terminal.resize(event.cols, event.rows)
      } else {
        await new Promise((resolve) => terminal.write(event.data, resolve))
      }
    }
  }

  async function openDrivenSession(message) {
    if (
      !pendingDrive ||
      message.requestId !== pendingDrive.requestId ||
      message.sessionId !== pendingDrive.sessionId
    ) {
      return
    }
    const session = sessions.get(message.sessionId)
    pendingDrive = null
    activeSessionId = message.sessionId
    sessionsView.classList.add('hidden')
    terminalView.classList.remove('hidden')
    terminalTitle.textContent = session?.name ?? 'Remote terminal'
    terminal.reset()
    fitting = true
    try {
      terminal.resize(message.cols, message.rows)
      await replay(message.history)
    } finally {
      fitting = false
    }
    await new Promise((resolve) => requestAnimationFrame(resolve))
    const size = dimensions()
    send({
      v: 1,
      type: 'pty-resize',
      sessionId: activeSessionId,
      ...size
    })
    terminal.focus()
    setStatus('driving', `Driving ${session?.name ?? message.sessionId}.`)
  }

  function release(reason) {
    const sessionId = activeSessionId
    if (sessionId) send({ v: 1, type: 'undrive', sessionId })
    showSessions()
    setStatus(desktopOnline ? 'peer-online' : 'waiting-desktop', reason)
  }

  function handleMessage(event) {
    if (typeof event.data !== 'string') {
      setStatus('protocol-error', 'Relay sent a non-text frame; disconnected for safety.')
      socket?.close(1003, 'text-only')
      return
    }
    const parsed = parseRemoteFrame(event.data)
    if (!parsed.ok) {
      setStatus('protocol-error', 'Relay sent an invalid protocol message.')
      socket?.close(1002, 'invalid-frame')
      return
    }
    const message = parsed.value
    switch (message.type) {
      case 'hello-ok':
        desktopOnline = message.peer.desktop
        disconnect.disabled = false
        connect.disabled = true
        joinInput.disabled = true
        renderSessions()
        setStatus(
          desktopOnline ? 'peer-online' : 'waiting-desktop',
          desktopOnline ? 'Desktop online. Choose a session.' : 'Connected. Waiting for the desktop…'
        )
        break
      case 'peer-join':
        if (message.role === 'desktop') {
          desktopOnline = true
          renderSessions()
          setStatus('peer-online', 'Desktop online. Choose a session.')
        }
        break
      case 'peer-leave':
        if (message.role === 'desktop') {
          desktopOnline = false
          sessions.clear()
          showSessions()
          setStatus('waiting-desktop', 'Desktop disconnected. Waiting for it to return…')
        }
        break
      case 'sessions-snapshot':
        sessions.clear()
        for (const session of message.sessions) sessions.set(session.sessionId, session)
        renderSessions()
        break
      case 'session-upsert':
        sessions.set(message.session.sessionId, message.session)
        renderSessions()
        break
      case 'session-removed':
        sessions.delete(message.sessionId)
        if (activeSessionId === message.sessionId) {
          showSessions()
          setStatus('peer-online', 'The remote session ended.')
        } else {
          renderSessions()
        }
        break
      case 'drive-ok':
        void openDrivenSession(message)
        break
      case 'drive-reject':
        if (pendingDrive?.requestId === message.requestId) {
          pendingDrive = null
          renderSessions()
          setStatus('peer-online', `Could not open that session (${message.reason}).`)
        }
        break
      case 'pty-out':
        if (message.sessionId === activeSessionId) {
          terminal.write(bytesFromBase64(message.data), () => {
            renderedPtyBytes += message.byteLength
            terminalHost.dataset.renderedPtyBytes = String(renderedPtyBytes)
            send({
              v: 1,
              type: 'pty-ack',
              sessionId: message.sessionId,
              bytes: message.byteLength
            })
          })
        }
        break
      case 'undriven':
        if (message.sessionId === activeSessionId) {
          showSessions()
          setStatus('peer-online', 'Returned to the session list.')
        }
        break
      case 'pty-exit':
        if (message.sessionId === activeSessionId) {
          terminal.writeln('\r\n\x1b[33m[Remote process exited]\x1b[0m')
          activeSessionId = null
          setStatus('session-exited', 'The remote process exited. Return to the session list.')
        }
        break
      case 'occupied':
        setStatus('occupied', 'This room already has another browser/phone controller.')
        socket?.close(1000, 'occupied')
        break
      case 'bad-key':
        setStatus('bad-key', 'This room is unavailable or has expired.')
        socket?.close(1000, 'bad-key')
        break
      case 'revoked':
        setStatus('revoked', 'This room was revoked.')
        socket?.close(1000, 'revoked')
        break
      default:
        break
    }
  }

  function resetConnection() {
    socket = null
    connectedRoomId = null
    desktopOnline = false
    pendingDrive = null
    activeSessionId = null
    sessions.clear()
    connect.disabled = false
    disconnect.disabled = true
    joinInput.disabled = false
    if (routeRoomId) joinInput.readOnly = true
    showSessions()
  }

  function disconnectNow() {
    closedByUser = true
    if (activeSessionId) {
      send({ v: 1, type: 'undrive', sessionId: activeSessionId })
    }
    socket?.close(1000, 'user-disconnect')
    resetConnection()
    setStatus('disconnected', 'Disconnected.')
  }

  connect.addEventListener('click', () => {
    if (socket) return
    const parsed = parseJoinUrl(joinInput.value)
    if (!parsed.ok) {
      setStatus('invalid-url', 'Enter a valid HTTPS join URL.')
      return
    }
    if (parsed.value.origin !== location.origin || parsed.value.base !== base) {
      setStatus('invalid-url', 'For safety, this demo only connects to this relay.')
      return
    }
    connectedRoomId = parsed.value.roomId
    closedByUser = false
    connect.disabled = true
    joinInput.disabled = true
    setStatus('connecting', 'Connecting…')
    const nextSocket = new WebSocket(parsed.value.wsUrl)
    socket = nextSocket
    nextSocket.addEventListener('open', () => {
      send({ v: 1, type: 'hello', role: 'phone', roomId: connectedRoomId })
    })
    nextSocket.addEventListener('message', handleMessage)
    nextSocket.addEventListener('error', () => {
      setStatus('connection-error', 'Could not connect to the relay.')
    })
    nextSocket.addEventListener('close', () => {
      if (socket !== nextSocket) return
      resetConnection()
      if (!closedByUser && status.dataset.phase !== 'revoked' && status.dataset.phase !== 'bad-key') {
        setStatus('disconnected', 'Connection closed.')
      }
    })
  })

  disconnect.addEventListener('click', disconnectNow)
  returnButton.addEventListener('click', () => release('Returned to the session list.'))
  terminal.onData(sendInput)
  terminal.onResize(({ cols, rows }) => {
    if (!activeSessionId || fitting) return
    send({ v: 1, type: 'pty-resize', sessionId: activeSessionId, cols, rows })
  })

  let resizeFrame = 0
  const observer = new ResizeObserver(() => {
    cancelAnimationFrame(resizeFrame)
    resizeFrame = requestAnimationFrame(() => {
      if (terminalView.classList.contains('hidden')) return
      dimensions()
    })
  })
  observer.observe(terminalHost)

  window.addEventListener('beforeunload', () => {
    if (activeSessionId) send({ v: 1, type: 'undrive', sessionId: activeSessionId })
    socket?.close(1000, 'page-close')
    observer.disconnect()
    renderer.dispose()
    terminal.dispose()
  })

  if (routeRoomId && !roomAvailable) {
    connect.disabled = true
    joinInput.disabled = true
    setStatus('bad-key', 'This room is unavailable or has expired.')
  }
}
