import { expect, test } from '@playwright/test';
import { DEMO, enterByFragment, expect119Reachable } from './helpers';

/*
 * 진입 경로 — 마스터플랜 §5 "QR URL fragment" · §0 "앱 설치 없이 5초 안에"
 *
 * fragment 키 3종이 모두 동작해야 한다:
 *   #card=   팔찌·스티커 (재사용 카드 참조)
 *   #ticket= 앱 화면 QR (백엔드 qrPayload)
 *   #t=      마스터플랜 §5 표기의 기존 데모 QR
 */
test.describe('QR 진입', () => {
  for (const key of ['card', 'ticket', 't'] as const) {
    test(`#${key}= 로 들어오면 Landing 을 거치지 않고 곧장 응급정보`, async ({ page }) => {
      await enterByFragment(page, key, DEMO.cpr);

      // 수동코드 폼이 잠깐이라도 보이면 안 된다 (첫 렌더부터 verifying 이어야 함).
      await expect(page.getByRole('button', { name: '코드로 열기' })).toHaveCount(0);

      await expect(page.getByRole('region', { name: '응급 최소정보' })).toBeVisible();
      await expect119Reachable(page);
    });
  }

  test('토큰이 주소창·히스토리에서 제거된다 (§5)', async ({ page }) => {
    await enterByFragment(page, 'ticket', DEMO.cpr);
    await expect(page.getByRole('region', { name: '응급 최소정보' })).toBeVisible();

    // fragment 가 남아 있으면 스크린샷·공유·히스토리로 토큰이 샌다.
    expect(page.url()).not.toContain(DEMO.cpr);
    expect(new URL(page.url()).hash).toBe('');
  });

  test('fragment 가 없으면 수동코드 화면', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: '코드로 열기' })).toBeVisible();
    await expect119Reachable(page);
  });

  test('깨진 fragment 는 정보를 렌더하지 않는다', async ({ page }) => {
    await page.goto('/#ticket=%E0%A4%A');
    await expect(page.getByRole('region', { name: '응급 최소정보' })).toHaveCount(0);
    await expect119Reachable(page);
  });
});
