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
      title: '接上远程控制台',
      lead: '登录之后，这里会发出一条远程 URL：手机变成遥控器，桌面会话留在原处。',
      submit: '登录',
      switchHint: '还没有账号？',
      switch: '注册'
    },
    register: {
      pageTitle: '注册 · HRack',
      title: '创建远程账号',
      lead: '先有账号，才有遥控器。桌面终端不搬家，确认和提问从手机接走。',
      submit: '创建账号',
      switchHint: '已经有账号？',
      switch: '登录'
    },
    points: [
      '会话继续跑在桌面，原生 TUI 一个字节都不走。',
      '确认、提问、出错——灯亮的时候，手机接得住。',
      '一条 URL 接上就行，不用再开第二套终端。'
    ],
    email: '邮箱',
    emailPlaceholder: 'you@studio.dev',
    password: '密码',
    confirm: '确认密码',
    passwordHint: '至少 8 位',
    showPassword: '显示密码',
    hidePassword: '隐藏密码',
    submitting: '连接中…',
    unavailable: '账号服务还没接上。表单已经就位，上线后从这里进控制台。',
    back: '返回首页',
    errors: {
      emailRequired: '填写邮箱。',
      emailInvalid: '邮箱格式不对。',
      passwordRequired: '填写密码。',
      passwordShort: '密码至少 8 位。',
      confirmRequired: '再输入一次密码。',
      confirmMismatch: '两次密码不一致。'
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
