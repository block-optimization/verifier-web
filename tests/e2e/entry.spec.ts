import { expect, test } from '@playwright/test';
import {
  CARD_REFS,
  enterByFragment,
  expectCommonFinderScreen,
  grantLocation,
  mockReverseGeocode,
} from './helpers';

/*
 * 진입 경로 — FE 수정요청서(2026-09-20) 「구현 요청」 1 · 2 · 4항.
 *
 * 팔찌와 환자 앱은 이제 같은 반영구 QR 하나를 쓴다:
 *   https://<host>/emergency#card=<opaque-reference>
 * 웹은 이 참조값으로 환자를 구분하지 않으므로, fragment 가 무엇이든 — 없어도 —
 * 화면은 완전히 같아야 한다.
 */
test.beforeEach(async ({ page }) => {
  await mockReverseGeocode(page);
  await grantLocation(page);
});

test.describe('QR 진입', () => {
  for (const key of ['card', 'ticket', 't'] as const) {
    test(`#${key}= 로 들어와도 공통 발견자 화면`, async ({ page }) => {
      await enterByFragment(page, key, CARD_REFS.alpha);
      await expectCommonFinderScreen(page);
    });
  }

  test('fragment 가 없어도 같은 공통 화면', async ({ page }) => {
    await page.goto('/');
    await expectCommonFinderScreen(page);
  });

  test('깨진 fragment 도 같은 공통 화면 (파싱하지 않으므로)', async ({ page }) => {
    await page.goto('/#ticket=%E0%A4%A');
    await expectCommonFinderScreen(page);
  });

  test('서로 다른 환자 QR 이 글자 하나까지 같은 화면을 낸다', async ({ page }) => {
    await enterByFragment(page, 'card', CARD_REFS.alpha);
    await expectCommonFinderScreen(page);
    const alpha = await page.locator('main').innerText();

    await enterByFragment(page, 'card', CARD_REFS.beta);
    await expectCommonFinderScreen(page);
    const beta = await page.locator('main').innerText();

    expect(beta, '환자별로 화면이 달라졌다 — 개인화가 남아 있다').toBe(alpha);
  });

  test('card 참조값이 주소창·히스토리에서 제거된다', async ({ page }) => {
    await enterByFragment(page, 'card', CARD_REFS.alpha);
    await expectCommonFinderScreen(page);

    // fragment 가 남아 있으면 스크린샷·공유·히스토리로 참조값이 샌다.
    expect(page.url()).not.toContain(CARD_REFS.alpha);
    expect(new URL(page.url()).hash).toBe('');

    // 뒤로 가기로도 되살아나면 안 된다 (pushState 가 아니라 replaceState 여야 함).
    await page.goBack().catch(() => {});
    expect(page.url()).not.toContain(CARD_REFS.alpha);
  });
});
