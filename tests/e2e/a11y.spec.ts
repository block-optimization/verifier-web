import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import {
  CARD_REFS,
  clickBelowDock,
  enterByFragment,
  expectCommonFinderScreen,
  grantLocation,
  mockReverseGeocode,
} from './helpers';

/*
 * 접근성 — 응급현장 사용자는 스트레스 상태이고, 고령자·저시력 사용자도 포함된다.
 * WCAG 2.1 A/AA 위반은 회귀로 취급한다.
 */
async function scan(page: import('@playwright/test').Page) {
  return new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
}

test('발견자 화면 (위치 확인됨)', async ({ page }) => {
  await mockReverseGeocode(page);
  await grantLocation(page);
  await enterByFragment(page, 'card', CARD_REFS.alpha);
  await expectCommonFinderScreen(page);

  const r = await scan(page);
  expect(r.violations, JSON.stringify(r.violations.map((v) => v.id))).toEqual([]);
});

test('발견자 화면 (위치 실패)', async ({ page }) => {
  await mockReverseGeocode(page, { status: 503 });
  await enterByFragment(page, 'card', CARD_REFS.alpha);
  await expectCommonFinderScreen(page);

  const r = await scan(page);
  expect(r.violations, JSON.stringify(r.violations.map((v) => v.id))).toEqual([]);
});

test('가이드 화면', async ({ page }) => {
  await mockReverseGeocode(page);
  await grantLocation(page);
  await page.goto('/');
  await clickBelowDock(page, /응급처치/);

  const r = await scan(page);
  expect(r.violations, JSON.stringify(r.violations.map((v) => v.id))).toEqual([]);
});
