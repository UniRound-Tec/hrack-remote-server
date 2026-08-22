import type { LandingStrings } from './zh-CN'

export const ko = {
  meta: {
    title: 'HRack — 코딩 에이전트를 위한 모던 터미널',
    description:
      'HRack 는 멀티 에이전트 코딩 워크플로를 위한 데스크톱 터미널입니다. 각 CLI 의 네이티브 TUI 를 그대로 유지하면서, 세션 상태 · 주의 알림 · 플로팅 모니터 · 읽기 전용 워크스페이스를 외곽에서 더합니다.'
  },
  nav: {
    docs: '문서',
    about: '소개',
    download: '다운로드',
    login: '로그인',
    register: '회원가입',
    language: '언어 전환',
    skipToContent: '본문으로 건너뛰기'
  },
  hero: {
    title: '코딩 에이전트를 위한 모던 터미널.',
    keyword: '터미널',
    sub: [
      '네이티브 TUI 는 그대로. 누가 생각하고, 도구를 쓰고, 확인을 기다리는지 한눈에 보입니다.',
      'HRack 이 모든 램프를 지켜봅니다. 당신은 옳은 자리로 돌아가면 됩니다.'
    ],
    promptNeedsYou: (n: number) => `확인 대기 ${n}건`,
    promptErrors: (n: number) => `오류 ${n}건`,
    promptWorking: (n: number) => `진행 중 ${n}건`,
    promptQuiet: '모두 순조롭게',
    download: 'HRack 다운로드',
    downloadFor: (os: string) => `${os}용 다운로드`,
    github: 'GitHub',
    remote: '원격 제어 URL 생성',
    platforms: 'Windows · macOS · Linux',
    license: 'Apache-2.0 · 무료 오픈소스',
    rackHint: '드래그 가능 · 데스크톱 플로팅 모니터와 같은 패널',
    rackLabel: 'HRack 플로팅 모니터'
  },
  auth: {
    eyebrow: 'remote',
    consoleLabel: 'console',
    sessionsLabel: 'sessions',
    consoleIdle: 'idle',
    pointKeys: ['desktop', 'phone', 'url'],
    login: {
      pageTitle: '로그인 · HRack',
      title: '원격 콘솔에 연결',
      lead: '로그인하면 여기에 원격 URL 이 발급됩니다. 휴대폰이 리모컨이 되고, 데스크톱 세션은 그 자리에 남습니다.',
      submit: '로그인',
      switchHint: '아직 계정이 없다면?',
      switch: '회원가입'
    },
    register: {
      pageTitle: '회원가입 · HRack',
      title: '원격 계정 만들기',
      lead: '먼저 계정. 데스크톱 터미널은 옮기지 않고, 확인과 질문은 휴대폰으로 넘깁니다.',
      submit: '계정 만들기',
      switchHint: '이미 계정이 있다면?',
      switch: '로그인'
    },
    verify: {
      pageTitle: '이메일 확인 · HRack',
      title: '이메일 인증 코드 입력',
      lead: '코드는 10분 동안 유효합니다. 여러 메일이 오면 가장 최근 코드를 사용하세요.',
      submit: '인증하고 계속',
      switchHint: '다른 계정이 필요한가요?',
      switch: '로그인으로 돌아가기'
    },
    points: [
      '세션은 데스크톱에서 계속 돌아갑니다. 네이티브 TUI 는 자리를 떠나지 않습니다.',
      '승인, 질문, 오류 — 램프가 켜지면 휴대폰이 받을 수 있습니다.',
      'URL 하나가 전부입니다. 두 번째 터미널은 필요 없습니다.'
    ],
    email: '이메일',
    emailPlaceholder: 'you@studio.dev',
    password: '비밀번호',
    confirm: '비밀번호 확인',
    passwordHint: '8자 이상',
    showPassword: '비밀번호 표시',
    hidePassword: '비밀번호 숨기기',
    submitting: '연결 중…',
    verifyLabel: 'email verification',
    otp: '인증 코드',
    otpPlaceholder: '000000',
    latestOtp: '가장 최근 메일 사용',
    resend: '코드 다시 보내기',
    resendIn: (seconds: number) => `${seconds}초 후 다시 보내기`,
    back: '홈으로 돌아가기',
    errors: {
      emailRequired: '이메일을 입력하세요.',
      emailInvalid: '이메일 형식이 올바르지 않습니다.',
      passwordRequired: '비밀번호를 입력하세요.',
      passwordShort: '비밀번호는 8자 이상이어야 합니다.',
      confirmRequired: '비밀번호를 한 번 더 입력하세요.',
      confirmMismatch: '두 비밀번호가 일치하지 않습니다.',
      otpRequired: '6자리 인증 코드를 입력하세요.',
      otpFormat: '인증 코드는 숫자 6자리여야 합니다.',
      invalidCredentials: '이메일 또는 비밀번호가 올바르지 않습니다.',
      emailNotVerified: '메일로 받은 6자리 코드로 이메일을 확인하세요.',
      mailUnavailable: '메일 서비스를 일시적으로 사용할 수 없습니다.',
      otpInvalid: '인증 코드가 올바르지 않습니다.',
      otpExpired: '인증 코드가 만료되었습니다. 다시 요청하세요.',
      tooManyAttempts: '시도 횟수가 너무 많습니다. 새 코드를 요청하세요.',
      rateLimited: '요청이 너무 많습니다. 잠시 후 다시 시도하세요.',
      banned: '이 계정은 비활성화되었습니다.',
      oauthFailed: '외부 서비스 로그인이 실패했습니다.',
      emailNotFound: '외부 서비스에서 이메일을 받지 못했습니다. 이메일 로그인을 사용하세요.',
      generic: '계정 서비스를 일시적으로 사용할 수 없습니다.'
    }
  },
  admin: {
    eyebrow: 'operator',
    navigation: '운영 콘솔 탐색',
    dashboard: '사용자 대시보드',
    signOut: '로그아웃',
    nav: {
      overview: '개요',
      users: '사용자',
      mail: '메일',
      oauth: 'OAuth'
    },
    overview: {
      title: '운영 콘솔',
      lead: '플랫폼 계정, 메일 전송, 외부 로그인을 관리합니다. 민감한 설정은 서버에서만 처리되며 브라우저에 반환되지 않습니다.'
    },
    sections: {
      users: {
        title: '사용자 관리',
        description: '계정, 역할, 인증 상태, 차단 상태를 확인합니다.'
      },
      mail: {
        title: '메일 및 인증',
        description: 'SMTP와 신규 계정의 이메일 인증 필요 여부를 설정합니다.'
      },
      oauth: {
        title: 'OAuth 제공자',
        description: 'GitHub 및 Google 로그인 클라이언트를 관리합니다.'
      }
    },
    comingSoon: '이 설정 패널은 후속 작업에서 연결됩니다.',
    settings: {
      loading: '설정을 불러오는 중…',
      loadFailed: '설정을 불러올 수 없습니다.',
      source: '출처',
      sources: { env: '환경 변수(읽기 전용)', db: '암호화 데이터베이스', default: '기본값' },
      host: '호스트',
      port: '포트',
      username: '사용자 이름(선택)',
      from: '보낸 사람',
      security: '전송 보안',
      password: '비밀번호',
      secretSaved: '저장됨. 비워 두면 유지',
      verification: '이메일 인증 요구',
      verificationHelp: '끄면 가입 후 바로 로그인합니다. 켜면 메일 전송이 가능해야 하며 미인증 계정은 다음 로그인 때 코드를 입력합니다.',
      save: '저장',
      saving: '저장 중…',
      sendTest: '테스트 메일 보내기',
      clear: 'DB 설정 지우기',
      saved: '설정이 저장되고 적용되었습니다.',
      testSent: '테스트 메일을 전송 요청했습니다.',
      pinnedError: '환경 변수로 고정된 설정이라 변경할 수 없습니다.',
      mailUnavailable: '인증을 켜기 전에 메일 전송을 설정하세요.',
      testFailed: '테스트 메일을 보낼 수 없습니다.',
      saveFailed: '설정을 저장할 수 없습니다. 입력값을 확인하세요.',
      mailTitle: '메일 및 인증',
      mailLead: 'SMTP 비밀번호는 서버에서 암호화되며 읽기 API로 반환되지 않습니다.',
      oauthTitle: 'OAuth 제공자',
      oauthLead: '저장 즉시 인증 인스턴스를 다시 불러오며 secret은 쓰기 전용입니다.',
      enabled: '사용',
      clientId: 'Client ID',
      clientSecret: 'Client secret',
      callbackUrl: '콜백 URL',
      providers: { github: 'GitHub', google: 'Google' }
    },
    setup: {
      title: '첫 운영자 만들기',
      lead: '관리자가 아직 없을 때만 열립니다. Setup token은 이 POST로만 전송되며 URL에 기록되지 않습니다.',
      token: 'Setup token',
      email: '관리자 이메일',
      password: '비밀번호',
      confirm: '비밀번호 확인',
      submit: '만들고 콘솔로 이동',
      submitting: '만드는 중…',
      back: '홈으로 돌아가기',
      errors: {
        invalidToken: 'Setup token이 올바르지 않습니다.',
        accountExists: '이 이메일에 이미 계정이 있습니다. 다른 이메일이나 CLI를 사용하세요.',
        invalidEmail: '올바른 관리자 이메일을 입력하세요.',
        invalidPassword: '비밀번호는 8~128자여야 합니다.',
        passwordMismatch: '비밀번호가 일치하지 않습니다.',
        unavailable: '초기 설정 진입점이 닫혔습니다.',
        generic: '관리자를 만들 수 없습니다. 잠시 후 다시 시도하세요.'
      }
    }
  },
  status: {
    working: '실행 중',
    needsYou: '확인 필요',
    done: '완료',
    error: '오류',
    idle: '대기',
    exited: '종료됨'
  },
  rack: {
    heading: 'sessions · live',
    needsYouHint: 'approve?',
    close: '닫기',
    collapse: '접기',
    expand: (count: number) => `세션 ${count}개 모두 보기`,
    attention: '확인 필요',
    reopen: '플로팅 모니터 표시'
  },
  states: {
    heading: '하나의 상태 언어로 모든 에이전트 읽기',
    intro:
      '각 Harness 의 Hooks · SSE · Extension 이벤트는 Adapter 를 거쳐 하나의 공유 어휘로 모입니다. 아래에서 누가 돌아가든, 당신이 읽어야 할 것은 여섯 개의 램프뿐입니다.',
    items: {
      working: '사고 · 도구 호출 · 명령 실행 — 순조롭게 진행 중.',
      needsYou: '승인이나 답변 대기 중. 그냥 두지 마세요.',
      done: '이번 턴 완료. 언제든 이어갈 수 있습니다.',
      error: '오류 또는 0이 아닌 종료. 한번 확인할 가치가 있습니다.',
      idle: '세션은 열려 있지만 아직 관찰된 활동 없음.',
      exited: '터미널 종료. 기록은 rack 에 남습니다.'
    }
  },
  flow: {
    heading: '옆에서 관찰, 간섭은 없음',
    intro:
      '이벤트는 터미널 바이트 스트림에 들어가지 않고, 터미널도 이벤트에 의존하지 않습니다. 두 경로는 독립적이어서 어느 쪽이 죽어도 상대를 해치지 않습니다.',
    nodes: {
      cli: 'CLI 세션',
      tui: '네이티브 TUI',
      adapter: 'Adapter',
      status: '상태와 알림',
      surfaces: '사이드바 · 플로팅 · 히스토리'
    },
    steps: [
      { title: '실행', desc: 'CLI 는 PTY 위에서 돌고, 네이티브 TUI 는 한 바이트도 바뀌지 않습니다.' },
      { title: '관찰', desc: 'Harness 마다 하나의 Adapter 가 공식 이벤트를 공유 어휘로 번역합니다.' },
      { title: '알림', desc: '상태는 사이드바 · 플로팅 · 히스토리로. 램프가 당신을 찾아갑니다.' }
    ],
    safety: 'Observer 가 죽어도 PTY 는 계속 실행됩니다. 상태 표시만 낮아질 뿐, 세션은 무사합니다.'
  },
  harnesses: {
    heading: 'Rack 위의 Harness',
    intro: '일곱 개의 깊은 통합, 더 많은 CLI 를 발견해 바로 실행.',
    statusLabel: '볼 수 있는 상태',
    host: '호스트',
    wsl: 'WSL',
    statuses: {
      dsh: '팔로우 중인 세션과 라이프사이클',
      'claude-code': '사고 · 도구 · 승인 · 완료',
      codex: '턴 · 도구 · 승인 · 압축',
      opencode: '세션 · 사고 · 도구 · 질문 · 권한',
      pi: '사고 · 응답 · 도구 · 턴',
      kimi: '턴 · 사고 · 도구 · 승인',
      grok: '턴 · 사고 · 도구 · 승인'
    },
    footnote:
      'Devin CLI · Cline · Qwen Code · Amp · Aider · Goose · GitHub Copilot CLI 등 더 많은 CLI 를 발견하고 빠르게 실행할 수 있습니다(현재는 실행만, 상태는 추후).'
  },
  download: {
    heading: 'rack 을 데스크톱에',
    intro: 'GitHub Releases 에서 최신 빌드를 받으세요. 무료 오픈소스.',
    go: 'GitHub Releases 로',
    note: '빌드는 아직 상용 코드 서명이 없어 첫 실행 때 보안 안내가 나타날 수 있습니다.',
    platforms: {
      windows: { name: 'Windows', hint: 'x64 · Setup .exe' },
      macos: { name: 'macOS', hint: 'Apple Silicon · .dmg' },
      linux: { name: 'Linux', hint: 'x64 · AppImage / .deb' }
    }
  },
  footer: {
    tagline: '머리를 비우고, Vibe Coding 으로.',
    links: {
      github: 'GitHub',
      releases: 'Releases',
      license: 'Apache-2.0'
    }
  }
} satisfies LandingStrings
