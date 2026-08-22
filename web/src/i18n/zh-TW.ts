import type { LandingStrings } from './zh-CN'

export const zhTW = {
  meta: {
    title: 'HRack — 為 Coding Agent 打造的現代終端機',
    description:
      'HRack 是面向多 Coding Agent 工作流程的桌面終端機：保留每個 CLI 的原生 TUI，在外層補上會話狀態、注意力提醒、懸浮監控與唯讀工作區。'
  },
  nav: {
    docs: '文件',
    about: '關於',
    download: '下載',
    login: '登入',
    register: '註冊',
    language: '切換語言',
    skipToContent: '跳到主要內容'
  },
  hero: {
    title: '一個為 Coding Agent 打造的現代終端機。',
    keyword: '終端機',
    sub: [
      '原生 TUI 一字不改。誰在思考、誰在呼叫工具、誰在等你確認，一目了然。',
      'HRack 替你盯著每一盞燈，你只管回到正確的地方。'
    ],
    promptNeedsYou: (n: number) => `${n} 個會話等你確認`,
    promptErrors: (n: number) => `${n} 個會話出錯`,
    promptWorking: (n: number) => `${n} 個進行中`,
    promptQuiet: '一切正常推進',
    download: '下載 HRack',
    downloadFor: (os: string) => `下載 ${os} 版`,
    github: 'GitHub',
    remote: '產生遠端控制 URL',
    platforms: 'Windows · macOS · Linux',
    license: 'Apache-2.0 · 免費開源',
    rackHint: '可拖曳 · 與桌面懸浮監控同一面板',
    rackLabel: 'HRack 懸浮監控'
  },
  auth: {
    eyebrow: 'remote',
    consoleLabel: 'console',
    sessionsLabel: 'sessions',
    consoleIdle: 'idle',
    pointKeys: ['desktop', 'phone', 'url'],
    login: {
      pageTitle: '登入 · HRack',
      title: '接上遠端控制台',
      lead: '登入之後，這裡會發出一條遠端 URL：手機變成遙控器，桌面會話留在原處。',
      submit: '登入',
      switchHint: '還沒有帳號？',
      switch: '註冊'
    },
    register: {
      pageTitle: '註冊 · HRack',
      title: '建立遠端帳號',
      lead: '先有帳號，才有遙控器。桌面終端機不搬家，確認和提問從手機接走。',
      submit: '建立帳號',
      switchHint: '已經有帳號？',
      switch: '登入'
    },
    points: [
      '會話繼續跑在桌面，原生 TUI 一個位元組都不走。',
      '確認、提問、出錯——燈亮的時候，手機接得住。',
      '一條 URL 接上就行，不用再開第二套終端機。'
    ],
    email: '電子郵件',
    emailPlaceholder: 'you@studio.dev',
    password: '密碼',
    confirm: '確認密碼',
    passwordHint: '至少 8 位',
    showPassword: '顯示密碼',
    hidePassword: '隱藏密碼',
    submitting: '連線中…',
    unavailable: '帳號服務還沒接上。表單已經就位，上線後從這裡進控制台。',
    back: '返回首頁',
    errors: {
      emailRequired: '填寫電子郵件。',
      emailInvalid: '電子郵件格式不對。',
      passwordRequired: '填寫密碼。',
      passwordShort: '密碼至少 8 位。',
      confirmRequired: '再輸入一次密碼。',
      confirmMismatch: '兩次密碼不一致。'
    }
  },
  status: {
    working: '執行中',
    needsYou: '需要你',
    done: '已完成',
    error: '出錯',
    idle: '閒置',
    exited: '已退出'
  },
  rack: {
    heading: 'sessions · live',
    needsYouHint: 'approve?',
    close: '關閉',
    collapse: '收合',
    expand: (count: number) => `展開全部 ${count} 個工作階段`,
    attention: '需處理',
    reopen: '顯示懸浮監控'
  },
  states: {
    heading: '一套狀態語言，認得所有 Agent',
    intro:
      '每個 Harness 的 Hooks、SSE 或 Extension 事件，都被 Adapter 收斂成同一套狀態。無論底下跑的是誰，你只需要認這六盞燈。',
    items: {
      working: '思考、呼叫工具、執行指令 —— 一切正常推進。',
      needsYou: '權限確認或等待回答：它在等你，別讓它白等。',
      done: '本輪完成，隨時可以繼續。',
      error: '報錯或非零退出，需要你看一眼。',
      idle: '會話開著，還沒觀察到活動。',
      exited: '終端機已結束，紀錄仍留在 rack 上。'
    }
  },
  flow: {
    heading: '旁路觀察，零侵入',
    intro:
      '事件不進終端機位元流，終端機也不依賴事件流。兩條路各走各的，誰壞了都不影響對方。',
    nodes: {
      cli: 'CLI 會話',
      tui: '原生 TUI',
      adapter: 'Adapter',
      status: '狀態與提醒',
      surfaces: '側欄 · 懸浮窗 · 歷史'
    },
    steps: [
      { title: '執行', desc: 'CLI 跑在 PTY 裡，原生 TUI 一個位元組都不改。' },
      { title: '觀察', desc: '每個 Harness 一個 Adapter，把官方事件翻譯成統一狀態。' },
      { title: '提醒', desc: '狀態同步到側欄、懸浮窗與歷史；誰需要你，燈就找到你。' }
    ],
    safety: 'Observer 失效時，PTY 繼續執行：狀態顯示降級，會話不受影響。'
  },
  harnesses: {
    heading: '已接入的 Harness',
    intro: '七個深度接入，更多可被發現並快速啟動。',
    statusLabel: '可見狀態',
    host: '主機',
    wsl: 'WSL',
    statuses: {
      dsh: '已關注會話與生命週期',
      'claude-code': '思考 · 工具 · 審批 · 完成',
      codex: '回合 · 工具 · 審批 · 上下文壓縮',
      opencode: '會話 · 怅考 · 工具 · 問題 · 權限',
      pi: '思考 · 回應 · 工具 · 回合',
      kimi: '回合 · 思考 · 工具 · 審批',
      grok: '回合 · 思考 · 工具 · 審批'
    },
    footnote:
      'Devin CLI、Cline、Qwen Code、Amp、Aider、Goose、Copilot CLI 等更多 CLI 可被發現並快速啟動（僅啟動，暫無狀態）。'
  },
  download: {
    heading: '把 rack 裝進你的桌面',
    intro: '從 GitHub Releases 下載最新構建，免費開源。',
    go: '前往 GitHub Releases',
    note: '構建暫未商業程式碼簽署，首次啟動可能出現系統安全提示。',
    platforms: {
      windows: { name: 'Windows', hint: 'x64 · Setup .exe' },
      macos: { name: 'macOS', hint: 'Apple Silicon · .dmg' },
      linux: { name: 'Linux', hint: 'x64 · AppImage / .deb' }
    }
  },
  footer: {
    tagline: '放空大腦，回到 Vibe Coding。',
    links: {
      github: 'GitHub',
      releases: 'Releases',
      license: 'Apache-2.0'
    }
  }
} satisfies LandingStrings
