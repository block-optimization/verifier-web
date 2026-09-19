import { expect, test } from '@playwright/test';
import {
  CARD_REFS,
  enterByFragment,
  expectCommonFinderScreen,
  grantLocation,
  mockReverseGeocode,
} from './helpers';

/*
 * 반복 시연 안정성 — 발표 당일 같은 팔찌를 수십 번 찍는다.
 * 상태가 누적되거나 이벤트 리스너가 새면 회차가 갈수록 실패한다.
 */
test.beforeEach(async ({ page }) => {
  await mockReverseGeocode(page);
  await grantLocation(page);
});

test('공통 화면 진입 20회 연속 성공', async ({ page }) => {
  test.slow(); // 20회 반복이라 기본 타임아웃으로는 부족하다.

  const refs = Object.values(CARD_REFS);
  for (let i = 0; i < 20; i += 1) {
    const ref = refs[i % refs.length];
    await enterByFragment(page, 'card', ref);
    await expectCommonFinderScreen(page);
    expect(page.url(), `${i + 1}회차에 fragment 가 남았다`).not.toContain(ref);
  }
});

test('같은 팔찌를 반복 스캔해도 계속 열린다', async ({ page }) => {
  // 물리 팔찌는 반영구 재사용이 전제다. 카드가 폐기됐더라도 이 공통 안내는 열린다.
  for (let i = 0; i < 5; i += 1) {
    await enterByFragment(page, 'card', CARD_REFS.alpha);
    await expectCommonFinderScreen(page);
  }
});
