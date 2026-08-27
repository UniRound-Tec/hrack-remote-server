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
      title: 'Continue your remote session',
      lead: 'Sign in to handle desktop approvals and actions securely from your phone.',
      submit: 'Sign in',
      switchHint: 'No account yet?',
      switch: 'Register'
    },
    register: {
      pageTitle: 'Register · HRack',
      title: 'Create an account. Stay connected.',
      lead: 'One secure link keeps your desktop session within reach.',
      submit: 'Create account and send code',
      switchHint: 'Already have an account?',
      switch: 'Sign in'
    },
    verify: {
      pageTitle: 'Verify email · HRack',
      title: 'Verify your email to continue',
      lead: 'Enter the latest 6-digit code we sent you.',
      submit: 'Verify and continue',
      switchHint: 'Need a different account?',
      switch: 'Back to sign in'
    },
    points: [
      'Desktop stays active',
      'Secure link',
      'Phone in control'
    ],
    email: 'Email',
    emailPlaceholder: 'you@studio.dev',
    password: 'Password',
    confirm: 'Confirm password',
    passwordHint: 'At least 8 characters',
    showPassword: 'Show password',
    hidePassword: 'Hide password',
    submitting: 'Connecting\u2026',
    sendingCode: 'Sending verification code\u2026',
    createAccount: 'Create account',
    mockLogin: 'Continue as root mock',
    mockLoading: 'Opening root dashboard…',
    verifyLabel: 'email verification',
    otp: 'Verification code',
    otpPlaceholder: '000000',
    latestOtp: 'Use the newest email',
    resend: 'Send / resend verification code',
    resendIn: (seconds: number) => `Resend in ${seconds}s`,
    socialDivider: 'or',
    social: {
      github: 'Continue with GitHub',
      google: 'Continue with Google'
    },
    back: 'Back to home',
    errors: {
      verificationSent: 'Code sent. Check your email and enter the newest 6-digit code.',
      emailRequired: 'Enter an email.',
      emailInvalid: 'That email does not look right.',
      passwordRequired: 'Enter a password.',
      passwordShort: 'Password must be at least 8 characters.',
      confirmRequired: 'Enter the password again.',
      confirmMismatch: 'The two passwords do not match.',
      otpRequired: 'Enter the 6-digit code.',
      otpFormat: 'The code must contain 6 digits.',
      invalidCredentials: 'The email or password is incorrect.',
      emailNotVerified: 'Confirm your email with the 6-digit code we sent.',
      mailUnavailable: 'Email delivery is temporarily unavailable. Try again later.',
      otpInvalid: 'That code is not valid. Check it and try again.',
      otpExpired: 'That code has expired. Request a new one.',
      tooManyAttempts: 'Too many attempts. Request a new code.',
      rateLimited: 'Too many requests. Try again shortly.',
      banned: 'This account has been disabled.',
      oauthFailed: 'Third-party sign-in failed. Try again.',
      emailNotFound: 'That provider did not return an email. Use email sign-in instead.',
      generic: 'The account service is temporarily unavailable. Try again later.'
    }
  },
  dashboard: {
    eyebrow: 'remote',
    title: 'Remote pairing',
    lead: 'One stable URL per account. Refreshes and service restarts never change it.',
    account: 'Current account',
    admin: 'Operator console',
    signOut: 'Sign out',
    mockNotice: 'Mock preview: this URL is visual only and never connects to Relay or a real device.',
    status: { ready: 'Ready', recovering: 'Recovering', stale: 'Rotation required' },
    empty: {
      title: 'Create your remote entry point',
      lead: 'Open it on a phone or another device. The URL changes only when you explicitly rotate it.',
      create: 'Create pairing URL',
      creating: 'Creating…'
    },
    active: {
      title: 'Your pairing URL',
      lead: 'Copy it or scan the QR code to open it on another device.',
      urlLabel: 'Pairing URL',
      createdAt: 'Created',
      copy: 'Copy',
      copied: 'Copied',
      copyFailed: 'Automatic copy failed. Select the URL and copy it manually.',
      rotate: 'Rotate URL',
      rotating: 'Rotating…',
      revoke: 'Revoke URL',
      revoking: 'Revoking…',
      recovering: 'Relay is restoring this persistent URL. You do not need to create another one.'
    },
    stale: {
      title: 'This pairing record cannot be restored',
      lead: 'The incompatible address is hidden for safety. An explicit rotation creates a new URL.',
      rotate: 'Rotate pairing URL'
    },
    confirm: {
      rotateTitle: 'Rotate the pairing URL?',
      rotateBody: 'Every saved copy of the old URL will stop working permanently, and a new URL will be created now.',
      rotate: 'Rotate URL',
      revokeTitle: 'Revoke the pairing URL?',
      revokeBody: 'The old URL will stop working permanently. You must create another one for future remote access.',
      revoke: 'Revoke URL',
      cancel: 'Cancel'
    },
    errors: {
      RELAY_UNAVAILABLE: 'Relay is temporarily unavailable. Try again shortly.',
      RELAY_CAPACITY: 'No remote pairing capacity is currently available.',
      PAIRING_CREATE_FAILED: 'The pairing URL could not be created. Try again.',
      PAIRING_REVOKE_FAILED: 'The old URL could not be confirmed inactive, so your record was left unchanged.',
      PAIRING_CHANGED: 'The pairing changed elsewhere. The view has been refreshed.',
      PAIRING_STALE: 'The pairing record must be rotated.',
      INVALID_REQUEST: 'This request is no longer valid. Refresh and try again.',
      UNAUTHORIZED: 'Your session has expired. Sign in again.',
      INTERNAL_ERROR: 'The operation could not be completed. Try again shortly.'
    },
    qrAlt: 'QR code for the pairing URL',
    refresh: 'Refresh status'
  },
  admin: {
    eyebrow: 'operator',
    navigation: 'Operator navigation',
    dashboard: 'User dashboard',
    signOut: 'Sign out',
    nav: {
      overview: 'Overview',
      users: 'Users',
      mail: 'Mail',
      oauth: 'OAuth'
    },
    overview: {
      title: 'Operator console',
      lead: 'Manage platform identities, email delivery, and third-party sign-in. Sensitive configuration stays on the server and is never returned to the browser.'
    },
    sections: {
      users: {
        title: 'User management',
        description: 'Inspect accounts, roles, verification, and ban status.'
      },
      mail: {
        title: 'Mail and verification',
        description: 'Configure SMTP and decide whether new accounts must verify email.'
      },
      oauth: {
        title: 'OAuth providers',
        description: 'Manage GitHub and Google sign-in clients.'
      }
    },
    comingSoon: 'This configuration panel is connected in a later slice.',
    settings: {
      loading: 'Loading settings…',
      loadFailed: 'Settings could not be loaded.',
      source: 'Source',
      sources: { env: 'Environment (read-only)', db: 'Encrypted database', default: 'Default' },
      host: 'Host',
      port: 'Port',
      username: 'Username (optional)',
      from: 'From address',
      security: 'Transport security',
      password: 'Password',
      secretSaved: 'Saved; leave blank to keep it',
      verification: 'Require email verification',
      verificationHelp: 'When off, registration signs in immediately. When on, mail must work and unverified accounts enter a code on their next sign-in.',
      save: 'Save',
      saving: 'Saving…',
      sendTest: 'Send test email',
      clear: 'Clear database settings',
      saved: 'Settings saved and active.',
      testSent: 'The test email was submitted for delivery.',
      pinnedError: 'This setting is pinned by the environment and cannot be changed here.',
      mailUnavailable: 'Configure working mail delivery before enabling verification.',
      testFailed: 'The test email could not be delivered.',
      saveFailed: 'Settings could not be saved. Check the entered values.',
      mailTitle: 'Mail and verification',
      mailLead: 'SMTP passwords are encrypted on the server and are never returned by read APIs.',
      oauthTitle: 'OAuth providers',
      oauthLead: 'The auth instance reloads immediately after save; client secrets are write-only.',
      enabled: 'Enabled',
      clientId: 'Client ID',
      clientSecret: 'Client secret',
      callbackUrl: 'Callback URL',
      providers: { github: 'GitHub', google: 'Google' }
    },
    userManagement: {
      title: 'User management',
      lead: 'Manage account status, verification, roles, sessions, and credentials. Sensitive actions run on the server and are audited.',
      loadFailed: 'The user list could not be loaded.',
      searchPlaceholder: 'Search by email',
      search: 'Search',
      account: 'Account',
      role: 'Role',
      verified: 'Verified',
      status: 'Status',
      created: 'Created',
      actions: 'Actions',
      userRole: 'User',
      adminRole: 'Administrator',
      yes: 'Yes',
      no: 'No',
      banned: 'Banned',
      active: 'Active',
      verify: 'Mark verified',
      ban: 'Ban',
      unban: 'Unban',
      revokeSessions: 'Revoke sessions',
      resetPassword: 'Reset password',
      delete: 'Delete',
      confirmDelete: 'Enter {email} to confirm permanent deletion:',
      temporaryPassword: 'One-time temporary password (it will not be shown again)',
      copy: 'Copy',
      empty: 'No users matched.',
      total: '{count} users total',
      previous: 'Previous',
      next: 'Next',
      actionSaved: 'The operation completed.',
      actionFailed: 'The operation failed.',
      lastAdmin: 'The last active administrator cannot be changed.',
      emailMismatch: 'The confirmation email does not match.',
      pairingFailed: 'The remote pairing could not be revoked, so the account was not deleted.',
      auditTitle: 'Recent audit',
      auditEmpty: 'No operator actions yet.'
    },
    setup: {
      title: 'Create the first operator',
      lead: 'This entry point is open only while the platform has no administrator. The setup token is sent only in this POST and is never written to the URL.',
      token: 'Setup token',
      email: 'Administrator email',
      password: 'Password',
      confirm: 'Confirm password',
      submit: 'Create and enter the console',
      submitting: 'Creating…',
      back: 'Back to home',
      errors: {
        invalidToken: 'The setup token is incorrect.',
        accountExists: 'That email already has an account. Use another email or the CLI.',
        invalidEmail: 'Enter a valid administrator email.',
        invalidPassword: 'Password must contain 8–128 characters.',
        passwordMismatch: 'The two passwords do not match.',
        unavailable: 'The setup entry point is closed.',
        generic: 'The administrator could not be created. Try again later.'
      }
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
