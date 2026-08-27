/**
 * zh-CN 是类型基准：`LandingStrings = typeof zhCN`，其余 locale 以
 * `satisfies LandingStrings` 保证 key 完整性（与主仓 i18n 同一套约定）。
 * 眉标（STATES / FLOW 等）与终端风格微标签属设计元素，各语言保持英文。
 */
export const zhCN = {
  meta: {
    title: 'HRack — 为 Coding Agent 打造的现代终端',
    description:
      'HRack 是面向多 Coding Agent 工作流的桌面终端：保留每个 CLI 的原生 TUI，在外层补上会话状态、注意力提醒、悬浮监控与只读工作区。'
  },
  nav: {
    docs: '文档',
    about: '关于',
    download: '下载',
    login: '登录',
    register: '注册',
    language: '切换语言',
    skipToContent: '跳到主要内容'
  },
  hero: {
    title: '一个为 Coding Agent 打造的现代终端。',
    keyword: '终端',
    sub: [
      '原生 TUI 一字不改。谁在思考、谁在调用工具、谁在等你确认，一目了然。',
      'HRack 替你盯着每一盏灯，你只管回到正确的地方。'
    ],
    promptNeedsYou: (n: number) => `${n} 个会话等你确认`,
    promptErrors: (n: number) => `${n} 个会话出错`,
    promptWorking: (n: number) => `${n} 个进行中`,
    promptQuiet: '一切正常推进',
    download: '下载 HRack',
    downloadFor: (os: string) => `下载 ${os} 版`,
    github: 'GitHub',
    remote: '生成远程控制 URL',
    platforms: 'Windows · macOS · Linux',
    license: 'Apache-2.0 · 免费开源',
    rackHint: '可拖动 · 与桌面悬浮监控同一面板',
    rackLabel: 'HRack 悬浮监控'
  },
  auth: {
    eyebrow: 'remote',
    consoleLabel: 'console',
    sessionsLabel: 'sessions',
    consoleIdle: 'idle',
    pointKeys: ['desktop', 'phone', 'url'],
    login: {
      pageTitle: '登录 · HRack',
      title: '继续远程会话',
      lead: '登录后，从手机安全接手桌面上的确认与操作。',
      submit: '登录',
      switchHint: '还没有账号？',
      switch: '注册'
    },
    register: {
      pageTitle: '注册 · HRack',
      title: '创建账号，随时接手',
      lead: '一个安全链接，让桌面会话与手机保持同步。',
      submit: '创建账号并发送验证码',
      switchHint: '已经有账号？',
      switch: '登录'
    },
    verify: {
      pageTitle: '验证邮箱 · HRack',
      title: '验证邮箱，继续连接',
      lead: '输入最新的 6 位验证码即可继续。',
      submit: '验证并继续',
      switchHint: '需要换个账号？',
      switch: '返回登录'
    },
    points: [
      '桌面持续运行',
      '安全链接同步',
      '手机随时接手'
    ],
    email: '邮箱',
    emailPlaceholder: 'you@studio.dev',
    password: '密码',
    confirm: '确认密码',
    passwordHint: '至少 8 位',
    showPassword: '显示密码',
    hidePassword: '隐藏密码',
    submitting: '连接中…',
    sendingCode: '正在发送验证码…',
    createAccount: '创建账号',
    mockLogin: '使用 Root Mock 进入',
    mockLoading: '正在进入 Root Dashboard…',
    verifyLabel: 'email verification',
    otp: '验证码',
    otpPlaceholder: '000000',
    latestOtp: '以最新一封为准',
    resend: '发送 / 重新发送验证码',
    resendIn: (seconds: number) => `${seconds} 秒后可重发`,
    socialDivider: '或者',
    social: {
      github: '使用 GitHub 继续',
      google: '使用 Google 继续'
    },
    back: '返回首页',
    errors: {
      verificationSent: '验证码已发送，请检查邮箱并输入最新的 6 位验证码。',
      emailRequired: '填写邮箱。',
      emailInvalid: '邮箱格式不对。',
      passwordRequired: '填写密码。',
      passwordShort: '密码至少 8 位。',
      confirmRequired: '再输入一次密码。',
      confirmMismatch: '两次密码不一致。',
      otpRequired: '填写 6 位验证码。',
      otpFormat: '验证码必须是 6 位数字。',
      invalidCredentials: '邮箱或密码不正确。',
      emailNotVerified: '请先用邮件中的 6 位验证码确认邮箱。',
      mailUnavailable: '邮件服务暂不可用，请稍后再试。',
      otpInvalid: '验证码不正确，请检查后重试。',
      otpExpired: '验证码已过期，请重新发送。',
      tooManyAttempts: '尝试次数过多，请重新发送验证码。',
      rateLimited: '操作太频繁，请稍后再试。',
      banned: '此账号已被禁用。',
      oauthFailed: '第三方登录失败，请重试。',
      emailNotFound: '第三方账号没有可用邮箱，请改用邮箱登录。',
      generic: '账号服务暂不可用，请稍后再试。'
    }
  },
  dashboard: {
    eyebrow: 'remote',
    title: '远程配对',
    lead: '每个账号一条稳定 URL。刷新页面或重启服务，地址都不会改变。',
    account: '当前账号',
    admin: '运营后台',
    signOut: '退出登录',
    mockNotice: 'Mock 预览：此 URL 仅用于查看界面样式，不会连接 Relay 或任何真实设备。',
    password: {
      trigger: '修改密码',
      title: '修改密码',
      lead: '验证当前密码后，为账号设置新的登录密码。',
      close: '关闭修改密码窗口',
      current: '当前密码',
      new: '新密码',
      confirm: '确认新密码',
      hint: '8–128 位',
      show: '显示密码',
      hide: '隐藏密码',
      revokeOther: '退出其他设备',
      revokeOtherHint: '当前设备保持登录，其他已登录会话将被撤销。',
      save: '保存新密码',
      saving: '正在保存…',
      cancel: '取消',
      success: '密码已更新。',
      mockUnavailable: 'Root Mock 的密码由开发登录自动管理。请使用普通账号测试真实改密。',
      errors: {
        currentRequired: '请输入当前密码。',
        newRequired: '请输入新密码。',
        newShort: '新密码至少需要 8 位。',
        newLong: '新密码不能超过 128 位。',
        newSame: '新密码不能与当前密码相同。',
        confirmRequired: '请再次输入新密码。',
        confirmMismatch: '两次输入的新密码不一致。',
        currentInvalid: '当前密码不正确。',
        noCredential: '此账号没有密码凭据，请继续使用已关联的登录方式。',
        rateLimited: '尝试次数过多，请稍后再试。',
        unauthorized: '登录已失效，请重新登录。',
        failed: '暂时无法修改密码，请稍后再试。'
      }
    },
    status: { ready: '可用', recovering: '正在恢复', stale: '需要轮换' },
    empty: {
      title: '创建你的远程入口',
      lead: '生成后可在手机或另一台设备打开。只有你显式轮换时 URL 才会改变。',
      create: '创建配对 URL',
      creating: '正在创建…'
    },
    region: {
      label: 'Relay 区域',
      switchLabel: '切换 Relay 区域',
      switchHint: '选择其他区域会重新生成配对 URL。',
      selected: '已选择',
      current: '当前',
      latency: '延迟',
      test: '测试延迟',
      testing: '测试中…',
      failed: '无法连接'
    },
    active: {
      title: '你的配对 URL',
      lead: '复制或扫描二维码，在另一台设备上打开。',
      urlLabel: '配对 URL',
      createdAt: '创建于',
      copy: '复制',
      copied: '已复制',
      copyFailed: '无法自动复制，请选中 URL 手动复制。',
      rotate: '轮换 URL',
      rotating: '正在轮换…',
      switching: '正在切换…',
      revoke: '吊销 URL',
      revoking: '正在吊销…',
      recovering: 'Relay 正在恢复这条持久 URL，无需重新创建。'
    },
    stale: {
      title: '这条配对记录无法恢复',
      lead: '出于安全考虑，已隐藏不兼容的地址。显式轮换会创建一条新 URL。',
      rotate: '轮换配对 URL'
    },
    confirm: {
      rotateTitle: '轮换配对 URL？',
      rotateBody: '所有已保存的旧地址会永久失效，并立即生成一条新地址。',
      rotate: '确认轮换',
      switchTitle: '切换 Relay 区域？',
      switchBody: '配对将迁移到 {region}。当前 URL 会失效，并重新生成一条新 URL。',
      switch: '确认切换',
      revokeTitle: '吊销配对 URL？',
      revokeBody: '旧地址会永久失效。之后如需远程访问，必须重新创建。',
      revoke: '确认吊销',
      cancel: '取消'
    },
    errors: {
      RELAY_UNAVAILABLE: 'Relay 暂时不可用，请稍后重试。',
      RELAY_CAPACITY: '当前没有可用的远程配对名额。',
      PAIRING_CREATE_FAILED: '无法创建配对 URL，请稍后重试。',
      PAIRING_REVOKE_FAILED: '无法确认旧 URL 已失效，记录保持不变。',
      PAIRING_CHANGED: '配对已在另一处改变，页面已刷新。',
      PAIRING_STALE: '配对记录需要轮换。',
      PAIRING_NODE_UNAVAILABLE: '该 Relay 区域当前不可用。',
      INVALID_REQUEST: '请求已失效，请刷新页面后重试。',
      UNAUTHORIZED: '登录已失效，请重新登录。',
      INTERNAL_ERROR: '暂时无法完成操作，请稍后重试。'
    },
    qrAlt: '配对 URL 二维码',
    refresh: '刷新状态'
  },
  admin: {
    eyebrow: 'operator',
    navigation: '运营后台导航',
    dashboard: '用户控制台',
    signOut: '退出登录',
    nav: {
      overview: '总览',
      users: '用户',
      mail: '邮件',
      oauth: 'OAuth'
    },
    overview: {
      title: '运营控制台',
      lead: '管理平台身份、邮件投递与第三方登录。敏感配置只在服务端处理，不会回传到浏览器。'
    },
    sections: {
      users: {
        title: '用户管理',
        description: '查看账号、角色、验证状态与禁用状态。'
      },
      mail: {
        title: '邮件与验证',
        description: '配置 SMTP，并决定新账号是否必须验证邮箱。'
      },
      oauth: {
        title: 'OAuth 提供商',
        description: '管理 GitHub 与 Google 登录客户端。'
      }
    },
    comingSoon: '此配置面板将在后续切片接入。',
    settings: {
      loading: '正在读取设置…',
      loadFailed: '无法读取设置。',
      source: '来源',
      sources: { env: '环境变量（只读）', db: '加密数据库', default: '默认值' },
      host: '主机',
      port: '端口',
      username: '用户名（可选）',
      from: '发件人',
      security: '传输安全',
      password: '密码',
      secretSaved: '已保存；留空保持不变',
      verification: '要求邮箱验证',
      verificationHelp: '关闭时注册后立即登录；打开后必须能发信，未验证账号下次登录需要填写验证码。',
      save: '保存',
      saving: '正在保存…',
      sendTest: '发送测试邮件',
      clear: '清除数据库设置',
      saved: '设置已保存并生效。',
      testSent: '测试邮件已提交发送。',
      pinnedError: '该设置由环境变量钉死，无法在后台修改。',
      mailUnavailable: '开启验证前必须先配置可用邮件服务。',
      testFailed: '测试邮件发送失败。',
      saveFailed: '设置保存失败，请检查填写内容。',
      mailTitle: '邮件与验证',
      mailLead: 'SMTP 密码加密保存在服务器中，读取接口永不返回秘密。',
      oauthTitle: 'OAuth 提供商',
      oauthLead: '保存后认证实例会立即热加载；client secret 仅写入。',
      enabled: '启用',
      clientId: 'Client ID',
      clientSecret: 'Client secret',
      callbackUrl: '回调 URL',
      providers: { github: 'GitHub', google: 'Google' }
    },
    userManagement: {
      title: '用户管理',
      lead: '管理账号状态、验证、角色、会话与凭据。高风险操作在服务端执行并写入审计。',
      loadFailed: '无法读取用户列表。',
      searchPlaceholder: '按邮箱搜索',
      search: '搜索',
      account: '账号',
      role: '角色',
      verified: '已验证',
      status: '状态',
      created: '创建时间',
      actions: '操作',
      userRole: '用户',
      adminRole: '管理员',
      yes: '是',
      no: '否',
      banned: '已禁用',
      active: '正常',
      verify: '强制验证',
      ban: '禁用',
      unban: '启用',
      revokeSessions: '撤销会话',
      resetPassword: '重置密码',
      delete: '删除',
      confirmDelete: '输入 {email} 以确认永久删除：',
      temporaryPassword: '一次性临时密码（离开后不再显示）',
      copy: '复制',
      empty: '没有匹配的用户。',
      total: '共 {count} 位用户',
      previous: '上一页',
      next: '下一页',
      actionSaved: '操作已完成。',
      actionFailed: '操作失败。',
      lastAdmin: '不能修改最后一位有效管理员。',
      emailMismatch: '确认邮箱不匹配。',
      pairingFailed: '无法撤销该用户的远程配对，账号未删除。',
      auditTitle: '最近审计',
      auditEmpty: '尚无运营操作。'
    },
    setup: {
      title: '创建首位运营者',
      lead: '此入口只在平台尚无管理员时开放。Setup token 仅随本次 POST 提交，不会写入 URL。',
      token: 'Setup token',
      email: '管理员邮箱',
      password: '密码',
      confirm: '确认密码',
      submit: '创建并进入后台',
      submitting: '正在创建…',
      back: '返回首页',
      errors: {
        invalidToken: 'Setup token 不正确。',
        accountExists: '该邮箱已有账号，请换一个邮箱或使用 CLI。',
        invalidEmail: '填写有效的管理员邮箱。',
        invalidPassword: '密码长度必须为 8–128 位。',
        passwordMismatch: '两次密码不一致。',
        unavailable: '初始化入口已关闭。',
        generic: '暂时无法创建管理员，请稍后重试。'
      }
    }
  },
  status: {
    working: '运行中',
    needsYou: '需要你',
    done: '已完成',
    error: '出错',
    idle: '空闲',
    exited: '已退出'
  },
  rack: {
    heading: 'sessions · live',
    needsYouHint: 'approve?',
    close: '关闭',
    collapse: '收起',
    expand: (count: number) => `展开全部 ${count} 个会话`,
    attention: '需处理',
    reopen: '显示悬浮监控'
  },
  states: {
    heading: '一套状态语言，认得所有 Agent',
    intro:
      '每个 Harness 的 Hooks、SSE 或 Extension 事件，都被 Adapter 收敛成同一套状态。无论底下跑的是谁，你只需要认这六盏灯。',
    items: {
      working: '思考、调用工具、执行命令 —— 一切正常推进。',
      needsYou: '权限确认或等待回答：它在等你，别让它白等。',
      done: '本轮完成，随时可以继续。',
      error: '报错或非零退出，需要你看一眼。',
      idle: '会话开着，还没观察到活动。',
      exited: '终端已结束，记录仍留在 rack 上。'
    }
  },
  flow: {
    heading: '旁路观察，零侵入',
    intro:
      '事件不进终端字节流，终端不依赖事件流。两条路各走各的，谁坏了都不影响对方。',
    nodes: {
      cli: 'CLI 会话',
      tui: '原生 TUI',
      adapter: 'Adapter',
      status: '状态与提醒',
      surfaces: '侧栏 · 悬浮窗 · 历史'
    },
    steps: [
      { title: '运行', desc: 'CLI 跑在 PTY 里，原生 TUI 一个字节都不改。' },
      { title: '观察', desc: '每个 Harness 一个 Adapter，把官方事件翻译成统一状态。' },
      { title: '提醒', desc: '状态同步到侧栏、悬浮窗与历史；谁需要你，灯就找到你。' }
    ],
    safety: 'Observer 失效时，PTY 继续运行：状态显示降级，会话不受影响。'
  },
  harnesses: {
    heading: '已接入的 Harness',
    intro: '七个深度接入，更多可被发现并快速启动。',
    statusLabel: '可见状态',
    host: '主机',
    wsl: 'WSL',
    statuses: {
      dsh: '已关注会话与生命周期',
      'claude-code': '思考 · 工具 · 审批 · 完成',
      codex: '回合 · 工具 · 审批 · 上下文压缩',
      opencode: '会话 · 思考 · 工具 · 问题 · 权限',
      pi: '思考 · 响应 · 工具 · 回合',
      kimi: '回合 · 思考 · 工具 · 审批',
      grok: '回合 · 思考 · 工具 · 审批'
    },
    footnote:
      'Devin CLI、Cline、Qwen Code、Amp、Aider、Goose、Copilot CLI 等更多 CLI 可被发现并快速启动（仅启动，暂无状态）。'
  },
  download: {
    heading: '把 rack 装进你的桌面',
    intro: '从 GitHub Releases 下载最新构建，免费开源。',
    go: '前往 GitHub Releases',
    note: '构建暂未商业代码签名，首次启动可能出现系统安全提示。',
    platforms: {
      windows: { name: 'Windows', hint: 'x64 · Setup .exe' },
      macos: { name: 'macOS', hint: 'Apple Silicon · .dmg' },
      linux: { name: 'Linux', hint: 'x64 · AppImage / .deb' }
    }
  },
  footer: {
    tagline: '放空大脑，回到 Vibe Coding。',
    links: {
      github: 'GitHub',
      releases: 'Releases',
      license: 'Apache-2.0'
    }
  }
}

export type LandingStrings = typeof zhCN
