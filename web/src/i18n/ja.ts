import type { LandingStrings } from './zh-CN'

export const ja = {
  meta: {
    title: 'HRack — コーディングエージェントのためのモダンなターミナル',
    description:
      'HRack はマルチエージェントなコーディングワークフローのためのデスクトップターミナル。各 CLI のネイティブ TUI をそのままに、セッション状態、アテンション通知、フローティングモニター、読み取り専用ワークスペースを外側から加えます。'
  },
  nav: {
    docs: 'ドキュメント',
    about: '概要',
    download: 'ダウンロード',
    login: 'サインイン',
    language: '言語を切り替える',
    skipToContent: '本文へスキップ'
  },
  hero: {
    title: 'コーディングエージェントのための、モダンなターミナル。',
    keyword: 'ターミナル',
    sub: [
      'ネイティブ TUI はそのまま。誰が考え、誰がツールを使い、誰が確認待ちか、一目でわかる。',
      'HRack がすべてのランプを見張ります。あなたは正しい場所へ戻るだけ。'
    ],
    promptNeedsYou: (n: number) => `確認待ち ${n} 件`,
    promptErrors: (n: number) => `エラー ${n} 件`,
    promptWorking: (n: number) => `実行中 ${n} 件`,
    promptQuiet: 'すべて順調',
    download: 'HRack をダウンロード',
    github: 'GitHub',
    remote: 'リモート URL を生成',
    platforms: 'Windows · macOS · Linux',
    license: 'Apache-2.0 · 無料オープンソース',
    rackHint: 'ドラッグできます · デスクトップのフローティングモニターと同じパネル',
    rackLabel: 'HRack フローティングモニター'
  },
  login: {
    title: 'HRack にサインイン',
    body: 'アカウント体制は準備中です。公開後、ここがリモート URL コンソールへ：たった一本の URL で、スマホが HRack のリモコンになります。',
    back: 'ホームへ戻る'
  },
  status: {
    working: '実行中',
    needsYou: '要確認',
    done: '完了',
    error: 'エラー',
    idle: 'アイドル',
    exited: '終了'
  },
  rack: {
    heading: 'sessions · live',
    needsYouHint: 'approve?',
    close: '閉じる',
    collapse: '折りたたむ',
    expand: (count: number) => `${count} 件すべて表示`,
    attention: '要対応',
    reopen: 'フローティングモニターを表示'
  },
  states: {
    heading: 'ひとつの状態言語で、すべてのエージェントを読む',
    intro:
      '各 Harness の Hooks・SSE・Extension イベントは、Adapter によってひとつの共有語彙へまとめられます。下で動くのがどの CLI でも、あなたが読むべきは 6 つのランプだけ。',
    items: {
      working: '思考、ツール呼び出し、コマンド実行 —— 順調に進行中。',
      needsYou: '承認や質問への回答待ち。放置せず、応えてください。',
      done: 'ターン完了。いつでも再開できます。',
      error: 'エラーまたは非ゼロ終了。一目見る価値あり。',
      idle: 'セッションは開いているが、まだ活動なし。',
      exited: 'ターミナル終了。記録は rack に残ります。'
    }
  },
  flow: {
    heading: '傍らから観測。干渉はゼロ。',
    intro:
      'イベントはターミナルのバイトストリームに入らず、ターミナルもイベントに依存しません。ふたつの経路は独立し、どちらが壊れても相手を巻き込みません。',
    nodes: {
      cli: 'CLI セッション',
      tui: 'ネイティブ TUI',
      adapter: 'Adapter',
      status: '状態と通知',
      surfaces: 'サイドバー · フローティング · 履歴'
    },
    steps: [
      { title: '実行', desc: 'CLI は PTY 上で動き、ネイティブ TUI は 1 バイトも変わりません。' },
      { title: '観測', desc: 'Harness ごとの Adapter が公式イベントを共有語彙へ翻訳します。' },
      { title: '通知', desc: '状態はサイドバー・フローティング・履歴へ。ランプがあなたを見つけます。' }
    ],
    safety: 'Observer が落ちても PTY は動き続けます。表示だけが低下し、セッションは無傷。'
  },
  harnesses: {
    heading: 'Rack の上の Harness',
    intro: '7 つの深い統合。さらに多くの CLI を発見して即起動。',
    statusLabel: '取得できる状態',
    host: 'ホスト',
    wsl: 'WSL',
    statuses: {
      dsh: 'フォロー中セッションとライフサイクル',
      'claude-code': '思考 · ツール · 承認 · 完了',
      codex: 'ターン · ツール · 承認 · 圧縮',
      opencode: 'セッション · 思考 · ツール · 質問 · 権限',
      pi: '思考 · 応答 · ツール · ターン',
      kimi: 'ターン · 思考 · ツール · 承認',
      grok: 'ターン · 思考 · ツール · 承認'
    },
    footnote:
      'Devin CLI、Cline、Qwen Code、Amp、Aider、Goose、GitHub Copilot CLI なども発続してクイック起動できます（現時点は起動のみ、状態なし）。'
  },
  download: {
    heading: 'rack をデスクトップへ',
    intro: 'GitHub Releases から最新ビルドをどうぞ。無料のオープンソース。',
    go: 'GitHub Releases へ',
    note: 'ビルドはまだ商用コード署名されていないため、初回起動時にセキュリティ警告が出ることがあります。',
    platforms: {
      windows: { name: 'Windows', hint: 'x64 · Setup .exe' },
      macos: { name: 'macOS', hint: 'Apple Silicon · .dmg' },
      linux: { name: 'Linux', hint: 'x64 · AppImage / .deb' }
    }
  },
  footer: {
    tagline: '頭を空に。Vibe Coding へ戻ろう。',
    links: {
      github: 'GitHub',
      releases: 'Releases',
      license: 'Apache-2.0'
    }
  }
} satisfies LandingStrings
