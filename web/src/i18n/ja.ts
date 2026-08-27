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
    register: '登録',
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
    downloadFor: (os: string) => `${os} 向けにダウンロード`,
    github: 'GitHub',
    remote: 'リモート URL を生成',
    platforms: 'Windows · macOS · Linux',
    license: 'Apache-2.0 · 無料オープンソース',
    rackHint: 'ドラッグできます · デスクトップのフローティングモニターと同じパネル',
    rackLabel: 'HRack フローティングモニター'
  },
  auth: {
    eyebrow: 'remote',
    consoleLabel: 'console',
    sessionsLabel: 'sessions',
    consoleIdle: 'idle',
    pointKeys: ['desktop', 'phone', 'url'],
    login: {
      pageTitle: 'サインイン · HRack',
      title: 'リモートセッションを続ける',
      lead: 'サインインして、デスクトップの確認や操作をスマホから安全に引き継げます。',
      submit: 'サインイン',
      switchHint: 'アカウントがない？',
      switch: '登録'
    },
    register: {
      pageTitle: '登録 · HRack',
      title: 'アカウントを作成して、いつでも接続',
      lead: 'ひとつの安全なリンクで、デスクトップセッションを手元に。',
      submit: 'アカウントを作成してコードを送信',
      switchHint: 'すでにアカウントがある？',
      switch: 'サインイン'
    },
    verify: {
      pageTitle: 'メールを確認 · HRack',
      title: 'メールを確認して続ける',
      lead: '最新の 6 桁コードを入力してください。',
      submit: '確認して続ける',
      switchHint: '別のアカウントを使う？',
      switch: 'サインインへ戻る'
    },
    points: [
      'デスクトップで継続',
      '安全なリンク',
      'スマホで操作'
    ],
    email: 'メール',
    emailPlaceholder: 'you@studio.dev',
    password: 'パスワード',
    confirm: 'パスワード（確認）',
    passwordHint: '8 文字以上',
    showPassword: 'パスワードを表示',
    hidePassword: 'パスワードを隠す',
    submitting: '接続中…',
    sendingCode: '確認コードを送信中…',
    createAccount: 'アカウントを作成',
    mockLogin: 'Root Mock で続ける',
    mockLoading: 'Root Dashboard を開いています…',
    verifyLabel: 'email verification',
    otp: '確認コード',
    otpPlaceholder: '000000',
    latestOtp: '最新のメールを使用',
    resend: '確認コードを送信 / 再送',
    resendIn: (seconds: number) => `${seconds} 秒後に再送`,
    socialDivider: 'または',
    social: {
      github: 'GitHub で続行',
      google: 'Google で続行'
    },
    back: 'ホームへ戻る',
    errors: {
      verificationSent: '確認コードを送信しました。メールに届いた最新の 6 桁コードを入力してください。',
      emailRequired: 'メールを入力してください。',
      emailInvalid: 'メールの形式が正しくありません。',
      passwordRequired: 'パスワードを入力してください。',
      passwordShort: 'パスワードは 8 文字以上です。',
      confirmRequired: 'パスワードをもう一度入力してください。',
      confirmMismatch: 'パスワードが一致しません。',
      otpRequired: '6 桁の確認コードを入力してください。',
      otpFormat: '確認コードは 6 桁の数字です。',
      invalidCredentials: 'メールまたはパスワードが正しくありません。',
      emailNotVerified: 'メールで届いた 6 桁のコードで確認してください。',
      mailUnavailable: 'メールサービスを一時的に利用できません。',
      otpInvalid: '確認コードが正しくありません。',
      otpExpired: '確認コードの期限が切れました。再送してください。',
      tooManyAttempts: '試行回数が多すぎます。コードを再送してください。',
      rateLimited: '操作が多すぎます。少し待ってから再試行してください。',
      banned: 'このアカウントは無効化されています。',
      oauthFailed: '外部サービスでのサインインに失敗しました。',
      emailNotFound: '外部サービスからメールを取得できません。メールでサインインしてください。',
      generic: 'アカウントサービスを一時的に利用できません。'
    }
  },
  dashboard: {
    eyebrow: 'remote',
    title: 'リモートペアリング',
    lead: 'アカウントごとに安定した URL が 1 つ。再読み込みやサービス再起動でも変わりません。',
    account: '現在のアカウント',
    admin: '運用コンソール',
    signOut: 'ログアウト',
    mockNotice: 'Mock プレビュー：この URL は表示専用で、Relay や実際の端末には接続しません。',
    password: {
      trigger: 'パスワード変更',
      title: 'パスワードを変更',
      lead: '現在のパスワードを確認して、新しいログインパスワードを設定します。',
      close: 'パスワード変更画面を閉じる',
      current: '現在のパスワード',
      new: '新しいパスワード',
      confirm: '新しいパスワードを確認',
      hint: '8～128 文字',
      show: 'パスワードを表示',
      hide: 'パスワードを隠す',
      revokeOther: '他の端末からログアウト',
      revokeOtherHint: 'この端末はログイン状態を保ち、他のセッションを無効にします。',
      save: '新しいパスワードを保存',
      saving: '保存中…',
      cancel: 'キャンセル',
      success: 'パスワードを更新しました。',
      mockUnavailable: 'Root Mock のパスワードは開発用ログインで管理されています。実際の変更は通常アカウントで確認してください。',
      errors: {
        currentRequired: '現在のパスワードを入力してください。',
        newRequired: '新しいパスワードを入力してください。',
        newShort: '新しいパスワードは 8 文字以上必要です。',
        newLong: '新しいパスワードは 128 文字以内です。',
        newSame: '現在とは異なるパスワードを指定してください。',
        confirmRequired: '新しいパスワードをもう一度入力してください。',
        confirmMismatch: '新しいパスワードが一致しません。',
        currentInvalid: '現在のパスワードが正しくありません。',
        noCredential: 'このアカウントにはパスワードがありません。連携済みの方法でログインしてください。',
        rateLimited: '試行回数が多すぎます。しばらくしてから再試行してください。',
        unauthorized: 'セッションが切れました。再度ログインしてください。',
        failed: 'パスワードを変更できませんでした。しばらくしてから再試行してください。'
      }
    },
    status: { ready: '利用可能', recovering: '復旧中', stale: 'ローテーションが必要' },
    empty: {
      title: 'リモート入口を作成',
      lead: 'スマートフォンや別の端末で開けます。明示的にローテーションしたときだけ URL が変わります。',
      create: 'ペアリング URL を作成',
      creating: '作成中…'
    },
    active: {
      title: 'ペアリング URL',
      lead: 'コピーするか QR コードを読み取り、別の端末で開いてください。',
      urlLabel: 'ペアリング URL',
      createdAt: '作成日時',
      copy: 'コピー',
      copied: 'コピー済み',
      copyFailed: '自動コピーに失敗しました。URL を選択して手動でコピーしてください。',
      rotate: 'URL をローテーション',
      rotating: 'ローテーション中…',
      revoke: 'URL を無効化',
      revoking: '無効化中…',
      recovering: 'Relay がこの永続 URL を復旧しています。再作成は不要です。'
    },
    stale: {
      title: 'このペアリング記録は復旧できません',
      lead: '安全のため互換性のない URL は非表示です。明示的なローテーションで新しい URL を作成します。',
      rotate: 'ペアリング URL をローテーション'
    },
    confirm: {
      rotateTitle: 'ペアリング URL をローテーションしますか？',
      rotateBody: '保存済みの古い URL はすべて永久に無効になり、新しい URL がすぐに作成されます。',
      rotate: 'ローテーション',
      revokeTitle: 'ペアリング URL を無効化しますか？',
      revokeBody: '古い URL は永久に無効になります。今後リモート接続するには再作成が必要です。',
      revoke: '無効化',
      cancel: 'キャンセル'
    },
    errors: {
      RELAY_UNAVAILABLE: 'Relay は一時的に利用できません。しばらくしてから再試行してください。',
      RELAY_CAPACITY: '現在、利用できるリモートペアリング枠がありません。',
      PAIRING_CREATE_FAILED: 'ペアリング URL を作成できませんでした。再試行してください。',
      PAIRING_REVOKE_FAILED: '古い URL の無効化を確認できなかったため、記録は変更していません。',
      PAIRING_CHANGED: '別の場所でペアリングが変更されました。表示を更新しました。',
      PAIRING_STALE: 'ペアリング記録のローテーションが必要です。',
      INVALID_REQUEST: 'リクエストが無効です。更新して再試行してください。',
      UNAUTHORIZED: 'セッションが切れました。再度ログインしてください。',
      INTERNAL_ERROR: '操作を完了できませんでした。しばらくしてから再試行してください。'
    },
    qrAlt: 'ペアリング URL の QR コード',
    refresh: '状態を更新'
  },
  admin: {
    eyebrow: 'operator',
    navigation: '運用コンソールのナビゲーション',
    dashboard: 'ユーザーダッシュボード',
    signOut: 'ログアウト',
    nav: {
      overview: '概要',
      users: 'ユーザー',
      mail: 'メール',
      oauth: 'OAuth'
    },
    overview: {
      title: '運用コンソール',
      lead: 'ユーザー、メール配信、外部ログインを管理します。機密設定はサーバー内だけで処理され、ブラウザーには返されません。'
    },
    sections: {
      users: {
        title: 'ユーザー管理',
        description: 'アカウント、ロール、認証状態、停止状態を確認します。'
      },
      mail: {
        title: 'メールと認証',
        description: 'SMTP と、新規アカウントのメール認証要件を設定します。'
      },
      oauth: {
        title: 'OAuth プロバイダー',
        description: 'GitHub と Google のログインクライアントを管理します。'
      }
    },
    comingSoon: 'この設定パネルは後続のスライスで接続されます。',
    settings: {
      loading: '設定を読み込み中…',
      loadFailed: '設定を読み込めませんでした。',
      source: 'ソース',
      sources: { env: '環境変数（読み取り専用）', db: '暗号化データベース', default: '既定値' },
      host: 'ホスト',
      port: 'ポート',
      username: 'ユーザー名（任意）',
      from: '送信元',
      security: '転送セキュリティ',
      password: 'パスワード',
      secretSaved: '保存済み。空欄なら維持',
      verification: 'メール認証を必須にする',
      verificationHelp: 'オフでは登録後すぐログインします。オンではメール送信が必須で、未認証アカウントは次回ログイン時にコードを入力します。',
      save: '保存',
      saving: '保存中…',
      sendTest: 'テストメールを送信',
      clear: 'DB 設定を消去',
      saved: '設定を保存して反映しました。',
      testSent: 'テストメールを送信キューに入れました。',
      pinnedError: '環境変数で固定されているため変更できません。',
      mailUnavailable: '認証を有効にする前にメール配信を設定してください。',
      testFailed: 'テストメールを送信できませんでした。',
      saveFailed: '設定を保存できませんでした。入力内容を確認してください。',
      mailTitle: 'メールと認証',
      mailLead: 'SMTP パスワードはサーバーで暗号化され、読み取り API から返されません。',
      oauthTitle: 'OAuth プロバイダー',
      oauthLead: '保存後すぐに認証インスタンスを再読み込みします。secret は書き込み専用です。',
      enabled: '有効',
      clientId: 'Client ID',
      clientSecret: 'Client secret',
      callbackUrl: 'コールバック URL',
      providers: { github: 'GitHub', google: 'Google' }
    },
    userManagement: {
      title: 'ユーザー管理',
      lead: 'アカウント状態、認証、ロール、セッション、認証情報を管理します。重要な操作はサーバーで実行され監査されます。',
      loadFailed: 'ユーザー一覧を読み込めませんでした。',
      searchPlaceholder: 'メールで検索',
      search: '検索',
      account: 'アカウント',
      role: 'ロール',
      verified: '認証済み',
      status: '状態',
      created: '作成日',
      actions: '操作',
      userRole: 'ユーザー',
      adminRole: '管理者',
      yes: 'はい',
      no: 'いいえ',
      banned: '停止中',
      active: '有効',
      verify: '認証済みにする',
      ban: '停止',
      unban: '再開',
      revokeSessions: 'セッション取消',
      resetPassword: 'パスワード再設定',
      delete: '削除',
      confirmDelete: '{email} を入力して完全削除を確認：',
      temporaryPassword: '一度だけ表示される仮パスワード',
      copy: 'コピー',
      empty: '一致するユーザーはいません。',
      total: '合計 {count} ユーザー',
      previous: '前へ',
      next: '次へ',
      actionSaved: '操作が完了しました。',
      actionFailed: '操作に失敗しました。',
      lastAdmin: '最後の有効な管理者は変更できません。',
      emailMismatch: '確認メールが一致しません。',
      pairingFailed: 'リモートペアリングを取り消せないため、アカウントは削除されませんでした。',
      auditTitle: '最近の監査',
      auditEmpty: '運用操作はまだありません。'
    },
    setup: {
      title: '最初の運用者を作成',
      lead: '管理者がまだ存在しない場合にのみ利用できます。Setup token はこの POST だけで送信され、URL には書き込まれません。',
      token: 'Setup token',
      email: '管理者メールアドレス',
      password: 'パスワード',
      confirm: 'パスワードを確認',
      submit: '作成してコンソールへ',
      submitting: '作成中…',
      back: 'ホームへ戻る',
      errors: {
        invalidToken: 'Setup token が正しくありません。',
        accountExists: 'このメールには既にアカウントがあります。別のメールか CLI を使用してください。',
        invalidEmail: '有効な管理者メールアドレスを入力してください。',
        invalidPassword: 'パスワードは 8〜128 文字で入力してください。',
        passwordMismatch: 'パスワードが一致しません。',
        unavailable: '初期設定エントリは閉じています。',
        generic: '管理者を作成できませんでした。しばらくしてから再試行してください。'
      }
    }
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
