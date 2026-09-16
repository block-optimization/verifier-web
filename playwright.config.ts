import { defineConfig, devices } from '@playwright/test';

/*
 * E2E 설정.
 *
 * 테스트는 mock 모드(`--mode test` → .env.test)로 돈다. 이유:
 *  · 실 백엔드 티켓은 5분 만료 + 단회용이라 재현 가능한 테스트를 쓸 수 없다
 *  · 백엔드가 내려가도 프론트 회귀는 잡아야 한다
 *  · 페르소나가 고정이라 단언이 결정적이다
 *
 * 실 백엔드 연동 확인은 tools/demo-ticket.ps1 로 수동 스모크한다.
 */
const PORT = 5188;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  timeout: 30_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'on-first-retry',
    // 응급현장 주 사용자는 모바일 브라우저다.
    ...devices['iPhone 13'],
    // .item 카드 페이드인(opacity 0→1) 도중 axe가 스캔하면 반투명 blend 색을
    // 잡아 color-contrast가 매번 다른 값으로 플레이키하게 실패한다. 앱 CSS가
    // 이미 prefers-reduced-motion을 지원하니 테스트에서도 그걸 켜서 없앤다.
    reducedMotion: 'reduce',
  },

  projects: [
    { name: 'mobile-safari', use: { ...devices['iPhone 13'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'] } },
  ],

  webServer: {
    command: `npx vite --mode test --port ${PORT} --strictPort`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
