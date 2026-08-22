import type { LandingStrings } from './zh-CN'

export const en = {
  meta: {
    title: 'HRack — The modern terminal for coding agents',
    description:
      'HRack is a desktop terminal for multi-agent coding workflows. It keeps every CLI\u2019s native TUI and adds the layer that is usually missing around it: session status, attention cues, a floating monitor, and a read-only workspace viewer.'
  },
  nav: {
    docs: 'Docs',
    about: 'About',
    download: 'Download',
    login: 'Sign in',
    register: 'Register',
    language: 'Switch language',
    skipToContent: 'Skip to main content'
  },
  hero: {
    title: 'The modern terminal for coding agents.',
    keyword: 'terminal',
    sub: [
      'The native TUI stays untouched. Who\u2019s thinking, who\u2019s calling tools, who\u2019s waiting on you \u2014 at a glance.',
      'HRack watches every light, so you can look away and land back in the right place.'
    ],
    promptNeedsYou: (n: number) =>
      n === 1 ? '1 session waiting on you' : `${n} sessions waiting on you`,
    promptErrors: (n: number) => (n === 1 ? '1 error' : `${n} errors`),
    promptWorking: (n: number) => (n === 1 ? '1 working' : `${n} working`),
    promptQuiet: 'All quiet',
    download: 'Download HRack',
    downloadFor: (os: string) => `Download for ${os}`,
    github: 'GitHub',
    remote: 'Generate remote URL',
    platforms: 'Windows · macOS · Linux',
    license: 'Apache-2.0 · free & open source',
    rackHint: 'Drag it — same panel as the desktop floating monitor',
    rackLabel: 'HRack floating monitor'
  },
  auth: {
    eyebrow: 'remote',
    consoleLabel: 'console',
    sessionsLabel: 'sessions',
    consoleIdle: 'idle',
    pointKeys: ['desktop', 'phone', 'url'],
    login: {
      pageTitle: 'Sign in · HRack',
      title: 'Plug into the remote console',
      lead: 'Once you sign in, this page issues one remote URL. Your phone becomes the remote; the desktop session stays put.',
      submit: 'Sign in',
      switchHint: 'No account yet?',
      switch: 'Register'
    },
    register: {
      pageTitle: 'Register · HRack',
      title: 'Create a remote account',
      lead: 'An account comes first. The desktop terminal does not move; approvals and questions travel to your phone.',
      submit: 'Create account',
      switchHint: 'Already have an account?',
      switch: 'Sign in'
    },
    points: [
      'The session keeps running on the desk. The native TUI does not leave the box.',
      'Approvals, questions, errors \u2014 when a lamp lights, the phone can take it.',
      'One URL is the whole handshake. No second terminal.'
    ],
    email: 'Email',
    emailPlaceholder: 'you@studio.dev',
    password: 'Password',
    confirm: 'Confirm password',
    passwordHint: 'At least 8 characters',
    showPassword: 'Show password',
    hidePassword: 'Hide password',
    submitting: 'Connecting\u2026',
    unavailable: 'Account service is not wired yet. The form is ready \u2014 this is where the console will open.',
    back: 'Back to home',
    errors: {
      emailRequired: 'Enter an email.',
      emailInvalid: 'That email does not look right.',
      passwordRequired: 'Enter a password.',
      passwordShort: 'Password must be at least 8 characters.',
      confirmRequired: 'Enter the password again.',
      confirmMismatch: 'The two passwords do not match.'
    }
  },
  status: {
    working: 'working',
    needsYou: 'needs you',
    done: 'done',
    error: 'error',
    idle: 'idle',
    exited: 'exited'
  },
  rack: {
    heading: 'sessions · live',
    needsYouHint: 'approve?',
    close: 'Close',
    collapse: 'Collapse',
    expand: (count: number) => `Show all ${count} sessions`,
    attention: 'need you',
    reopen: 'Show floating monitor'
  },
  states: {
    heading: 'One status language for every agent',
    intro:
      'Hooks, SSE streams, and extension events from every harness are converged into one shared vocabulary. It does not matter which CLI is underneath \u2014 you only need to read six lamps.',
    items: {
      working: 'Thinking, calling tools, running commands \u2014 everything on track.',
      needsYou: 'An approval or a question: it is waiting on you. Do not let it wait alone.',
      done: 'Turn complete, ready whenever you are.',
      error: 'A failure or non-zero exit. Worth a look.',
      idle: 'Session open, nothing observed yet.',
      exited: 'Terminal ended; the record stays on the rack.'
    }
  },
  flow: {
    heading: 'Observe from the side. Intrude never.',
    intro:
      'Events never enter the terminal byte stream, and the terminal never depends on the event stream. Two paths, one rack \u2014 either side can fail without touching the other.',
    nodes: {
      cli: 'CLI session',
      tui: 'native TUI',
      adapter: 'Adapter',
      status: 'status & alerts',
      surfaces: 'sidebar · floating · history'
    },
    steps: [
      { title: 'Run', desc: 'The CLI lives in a PTY. Its native TUI is not touched, byte for byte.' },
      { title: 'Observe', desc: 'One adapter per harness translates official events into the shared vocabulary.' },
      { title: 'Alert', desc: 'Status flows to the sidebar, floating window, and history \u2014 the lamp finds you.' }
    ],
    safety: 'If an observer fails, the PTY keeps running: the status degrades, the session does not.'
  },
  harnesses: {
    heading: 'Harnesses on the rack',
    intro: 'Seven deep integrations, many more discovered and ready to launch.',
    statusLabel: 'Status available',
    host: 'Host',
    wsl: 'WSL',
    statuses: {
      dsh: 'followed sessions & lifecycle',
      'claude-code': 'thinking · tools · approvals · completion',
      codex: 'turns · tools · approvals · compaction',
      opencode: 'sessions · thinking · tools · questions · permissions',
      pi: 'thinking · responses · tools · turns',
      kimi: 'turns · thinking · tools · approvals',
      grok: 'turns · thinking · tools · approvals'
    },
    footnote:
      'Devin CLI, Cline, Qwen Code, Amp, Aider, Goose, GitHub Copilot CLI and more can be discovered and quick-launched (launch-only for now, no status yet).'
  },
  download: {
    heading: 'Put the rack on your desktop',
    intro: 'Grab the latest build from GitHub Releases. Free and open source.',
    go: 'Go to GitHub Releases',
    note: 'Builds are not commercially code-signed yet; your OS may show a security prompt on first launch.',
    platforms: {
      windows: { name: 'Windows', hint: 'x64 · Setup .exe' },
      macos: { name: 'macOS', hint: 'Apple Silicon · .dmg' },
      linux: { name: 'Linux', hint: 'x64 · AppImage / .deb' }
    }
  },
  footer: {
    tagline: 'Free your mind. Get back to vibe coding.',
    links: {
      github: 'GitHub',
      releases: 'Releases',
      license: 'Apache-2.0'
    }
  }
} satisfies LandingStrings
