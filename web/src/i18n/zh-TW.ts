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
    verify: {
      pageTitle: '驗證電子郵件 · HRack',
      title: '輸入電子郵件驗證碼',
      lead: '驗證碼 10 分鐘內有效。若收到多封郵件，請使用最新一封。',
      submit: '驗證並繼續',
      switchHint: '需要換個帳號？',
      switch: '返回登入'
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
    verifyLabel: 'email verification',
    otp: '驗證碼',
    otpPlaceholder: '000000',
    latestOtp: '以最新一封為準',
    resend: '重發驗證碼',
    resendIn: (seconds: number) => `${seconds} 秒後可重發`,
    socialDivider: '或者',
    social: {
      github: '使用 GitHub 繼續',
      google: '使用 Google 繼續'
    },
    back: '返回首頁',
    errors: {
      emailRequired: '填寫電子郵件。',
      emailInvalid: '電子郵件格式不對。',
      passwordRequired: '填寫密碼。',
      passwordShort: '密碼至少 8 位。',
      confirmRequired: '再輸入一次密碼。',
      confirmMismatch: '兩次密碼不一致。',
      otpRequired: '請填寫 6 位驗證碼。',
      otpFormat: '驗證碼必須是 6 位數字。',
      invalidCredentials: '電子郵件或密碼不正確。',
      emailNotVerified: '請先用郵件中的 6 位驗證碼確認電子郵件。',
      mailUnavailable: '郵件服務暫時無法使用，請稍後再試。',
      otpInvalid: '驗證碼不正確，請檢查後重試。',
      otpExpired: '驗證碼已過期，請重新傳送。',
      tooManyAttempts: '嘗試次數過多，請重新傳送驗證碼。',
      rateLimited: '操作太頻繁，請稍後再試。',
      banned: '此帳號已被停用。',
      oauthFailed: '第三方登入失敗，請重試。',
      emailNotFound: '第三方帳號沒有可用電子郵件，請改用電子郵件登入。',
      generic: '帳號服務暫時無法使用，請稍後再試。'
    }
  },
  admin: {
    eyebrow: 'operator',
    navigation: '營運後台導覽',
    dashboard: '使用者控制台',
    signOut: '登出',
    nav: {
      overview: '總覽',
      users: '使用者',
      mail: '郵件',
      oauth: 'OAuth'
    },
    overview: {
      title: '營運控制台',
      lead: '管理平台身分、郵件投遞與第三方登入。敏感設定只在伺服器端處理，不會回傳到瀏覽器。'
    },
    sections: {
      users: {
        title: '使用者管理',
        description: '檢視帳號、角色、驗證狀態與停權狀態。'
      },
      mail: {
        title: '郵件與驗證',
        description: '設定 SMTP，並決定新帳號是否必須驗證電子郵件。'
      },
      oauth: {
        title: 'OAuth 提供商',
        description: '管理 GitHub 與 Google 登入用戶端。'
      }
    },
    comingSoon: '此設定面板將在後續切片接入。',
    settings: {
      loading: '正在讀取設定…',
      loadFailed: '無法讀取設定。',
      source: '來源',
      sources: { env: '環境變數（唯讀）', db: '加密資料庫', default: '預設值' },
      host: '主機',
      port: '連接埠',
      username: '使用者名稱（選填）',
      from: '寄件者',
      security: '傳輸安全',
      password: '密碼',
      secretSaved: '已儲存；留空保持不變',
      verification: '要求電子郵件驗證',
      verificationHelp: '關閉時註冊後立即登入；開啟後必須能寄信，未驗證帳號下次登入需要輸入驗證碼。',
      save: '儲存',
      saving: '正在儲存…',
      sendTest: '傳送測試郵件',
      clear: '清除資料庫設定',
      saved: '設定已儲存並生效。',
      testSent: '測試郵件已送交傳送。',
      pinnedError: '此設定由環境變數固定，無法在後台修改。',
      mailUnavailable: '開啟驗證前必須先設定可用的郵件服務。',
      testFailed: '測試郵件傳送失敗。',
      saveFailed: '設定儲存失敗，請檢查輸入內容。',
      mailTitle: '郵件與驗證',
      mailLead: 'SMTP 密碼會加密儲存在伺服器，讀取介面永不回傳秘密。',
      oauthTitle: 'OAuth 提供商',
      oauthLead: '儲存後認證執行個體會立即熱載入；client secret 僅供寫入。',
      enabled: '啟用',
      clientId: 'Client ID',
      clientSecret: 'Client secret',
      callbackUrl: '回呼 URL',
      providers: { github: 'GitHub', google: 'Google' }
    },
    userManagement: {
      title: '使用者管理',
      lead: '管理帳號狀態、驗證、角色、工作階段與憑證。高風險操作在伺服器執行並寫入稽核。',
      loadFailed: '無法讀取使用者清單。',
      searchPlaceholder: '依電子郵件搜尋',
      search: '搜尋',
      account: '帳號',
      role: '角色',
      verified: '已驗證',
      status: '狀態',
      created: '建立時間',
      actions: '操作',
      userRole: '使用者',
      adminRole: '管理員',
      yes: '是',
      no: '否',
      banned: '已停用',
      active: '正常',
      verify: '強制驗證',
      ban: '停用',
      unban: '啟用',
      revokeSessions: '撤銷工作階段',
      resetPassword: '重設密碼',
      delete: '刪除',
      confirmDelete: '輸入 {email} 以確認永久刪除：',
      temporaryPassword: '一次性臨時密碼（離開後不再顯示）',
      copy: '複製',
      empty: '沒有符合的使用者。',
      total: '共 {count} 位使用者',
      previous: '上一頁',
      next: '下一頁',
      actionSaved: '操作已完成。',
      actionFailed: '操作失敗。',
      lastAdmin: '不能修改最後一位有效管理員。',
      emailMismatch: '確認電子郵件不相符。',
      pairingFailed: '無法撤銷此使用者的遠端配對，帳號未刪除。',
      auditTitle: '最近稽核',
      auditEmpty: '尚無營運操作。'
    },
    setup: {
      title: '建立首位營運者',
      lead: '此入口只在平台尚無管理員時開放。Setup token 只隨本次 POST 傳送，不會寫入網址。',
      token: 'Setup token',
      email: '管理員電子郵件',
      password: '密碼',
      confirm: '確認密碼',
      submit: '建立並進入後台',
      submitting: '正在建立…',
      back: '返回首頁',
      errors: {
        invalidToken: 'Setup token 不正確。',
        accountExists: '此電子郵件已有帳號，請改用其他信箱或 CLI。',
        invalidEmail: '請輸入有效的管理員電子郵件。',
        invalidPassword: '密碼長度必須為 8–128 個字元。',
        passwordMismatch: '兩次輸入的密碼不一致。',
        unavailable: '初始化入口已關閉。',
        generic: '暫時無法建立管理員，請稍後再試。'
      }
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
