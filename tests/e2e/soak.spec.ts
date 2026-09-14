import { expect, test } from '@playwright/test';
import { DEMO, enterByFragment, expect119Reachable } from './helpers';

/*
 * 마스터플랜 P0-12 수용 기준 — "핵심 시나리오를 20회 연속 성공"
 *
 * 발표 당일 반복 시연에서 중간에 무너지지 않는지 본다. 상태가 누적되거나
 * 이벤트 리스너가 새면 회차가 갈수록 실패한다.
 */
test('핵심 흐름 20회 연속 성공', async ({ page }) => {
  test.slow(); // 20회 반복이라 기본 타임아웃으로는 부족하다.

  const personas = Object.values(DEMO);
  for (let i = 0; i < 20; i += 1) {
    const code = personas[i % personas.length];
    await enterByFragment(page, 'card', code);

    await expect(
      page.getByRole('region', { name: '응급 최소정보' }),
      `${i + 1}회차 실패 (code=${code})`,
    ).toBeVisible();
    await expect119Reachable(page);
  }
});

test('같은 팔찌를 반복 스캔해도 계속 열린다', async ({ page }) => {
  // 물리 팔찌는 재사용이 전제다. 같은 참조로 5회 연속 진입한다.
  for (let i = 0; i < 5; i += 1) {
    await enterByFragment(page, 'card', DEMO.cpr);
    await expect(
      page.getByRole('region', { name: '응급 최소정보' }),
      `${i + 1}회차 재스캔 실패`,
    ).toBeVisible();
  }
});
