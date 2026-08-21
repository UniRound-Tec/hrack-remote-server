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
    language: '언어 전환',
    skipToContent: '본문으로 건너뛰기'
  },
  hero: {
    title: '코딩 에이전트를 위한 모던 터미널.',
    keyword: '터미널',
    sub: '네이티브 TUI 는 그대로. 누가 사고하고, 누가 도구를 쓰고, 누가 당신의 확인을 기다리는지 —— rack 이 모든 램프를 지켜봅니다. 당신은 옳은 자리로 돌아가면 됩니다.',
    promptNeedsYou: (n: number) => `확인 대기 ${n}건`,
    promptErrors: (n: number) => `오류 ${n}건`,
    promptWorking: (n: number) => `진행 중 ${n}건`,
    promptQuiet: '모두 순조롭게',
    download: 'HRack 다운로드',
    github: 'GitHub',
    remote: '원격 제어 URL 생성',
    platforms: 'Windows · macOS · Linux',
    license: 'Apache-2.0 · 무료 오픈소스',
    rackHint: '드래그 가능 · 데스크톱 플로팅 모니터와 같은 패널',
    rackLabel: 'HRack 플로팅 모니터'
  },
  login: {
    title: 'HRack 로그인',
    body: '계정 체계는 준비 중입니다. 출시 후 이곳이 원격 제어 URL 콘솔이 됩니다: URL 하나로 휴대폰이 HRack 의 리모컨이 됩니다.',
    back: '홈으로 돌아가기'
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
