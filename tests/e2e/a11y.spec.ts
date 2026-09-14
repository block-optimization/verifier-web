import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { DEMO, FAILURE, clickBelowDock, enterByFragment, enterByManualCode } from './helpers';

/*
 * 접근성 — 응급현장 사용자는 스트레스 상태이고, 고령자·저시력 사용자도 포함된다.
 * WCAG 2.1 A/AA 위반은 회귀로 취급한다.
 */
async function scan(page: import('@playwright/test').Page) {
  return new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
}

test('수동코드 화면', async ({ page }) => {
  await page.goto('/');
  const r = await scan(page);
  expect(r.violations, JSON.stringify(r.violations.map((v) => v.id))).toEqual([]);
});

test('응급정보 화면', async ({ page }) => {
  await enterByFragment(page, 'ticket', DEMO.cpr);
  await expect(page.getByRole('region', { name: '응급 최소정보' })).toBeVisible();
  const r = await scan(page);
  expect(r.violations, JSON.stringify(r.violations.map((v) => v.id))).toEqual([]);
});

test('오류 화면', async ({ page }) => {
  await enterByManualCode(page, FAILURE.expired);
  await expect(page.getByRole('alert')).toBeVisible();
  const r = await scan(page);
  expect(r.violations, JSON.stringify(r.violations.map((v) => v.id))).toEqual([]);
});

test('가이드 화면', async ({ page }) => {
  await page.goto('/');
  await clickBelowDock(page, /응급처치/);
  const r = await scan(page);
  expect(r.violations, JSON.stringify(r.violations.map((v) => v.id))).toEqual([]);
});
