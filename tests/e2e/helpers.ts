import { expect, type Page } from '@playwright/test';

/** mock 페르소나 — src/api/emergencyAccess.ts 의 PERSONAS 와 일치해야 한다. */
export const DEMO = {
  cpr: 'M3D1-7K9Q',
  asthma: 'M3D2-A1B2',
  pacemaker: 'M3D3-C3D4',
  diabetes: 'M3D4-E5F6',
} as const;

export const FAILURE = {
  expired: 'M3D1-EXPR',
  revoked: 'M3D1-REVK',
  tampered: 'M3D1-TAMP',
  rateLimited: 'M3D1-RATE',
} as const;

/**
 * 발견자가 절대 봐서는 안 되는 값들 (마스터플랜 §7 #8).
 * 어떤 화면에서도 이 라벨이 나타나면 실패로 본다.
 */
export const FORBIDDEN_LABELS = ['주민등록번호', '주민번호', '인적사항', '전체 병력', '전체 처방'];

/** QR 스캔 진입 — fragment 로 들어온 상황을 재현한다. */
export async function enterByFragment(page: Page, key: 'card' | 'ticket' | 't', value: string) {
  await page.goto(`/#${key}=${value}`);
}

/** 수동코드 입력 경로. */
export async function enterByManualCode(page: Page, code: string) {
  await page.goto('/');
  await page.getByLabel('수동코드').fill(code);
  await page.getByRole('button', { name: '코드로 열기' }).click();
}

/** 어느 화면이든 119 전화 버튼이 살아 있어야 한다 (§7 "실패해도 119 는 유지"). */
export async function expect119Reachable(page: Page) {
  const call = page.getByRole('link', { name: /119/ });
  await expect(call).toBeVisible();
  await expect(call).toHaveAttribute('href', 'tel:119');
}

/** 화면 어디에도 금지 라벨이 없어야 한다. */
export async function expectNoForbiddenLabels(page: Page) {
  const body = await page.locator('body').innerText();
  for (const label of FORBIDDEN_LABELS) {
    // "인적사항 · 병력 · 처방은 공개되지 않습니다" 같은 고지 문구는 허용한다.
    const isDisclaimerOnly = new RegExp(`${label}[^\n]{0,40}(공개되지|노출하지|않습니다)`).test(body);
    if (!isDisclaimerOnly) {
      expect(body, `금지 라벨 "${label}" 이 화면에 노출됨`).not.toContain(label);
    }
  }
}

/**
 * 하단 고정 dock 아래에 깔린 버튼을 누른다.
 *
 * 119 dock 은 position:fixed 라 초기 스크롤 위치에서 페이지 끝 요소를 덮는다.
 * `.page` 의 padding-bottom 이 스크롤 여유를 확보해 두므로, 실제 사용자는
 * 스크롤해서 누른다. 테스트도 같은 경로를 밟아야 한다.
 */
export async function clickBelowDock(page: Page, name: RegExp | string) {
  const target = page.getByRole('button', { name });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(target).toBeVisible();
  await target.click();
}
