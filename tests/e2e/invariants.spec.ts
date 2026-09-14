import { expect, test } from '@playwright/test';
import { DEMO, clickBelowDock, enterByFragment, enterByManualCode, expect119Reachable, expectNoForbiddenLabels } from './helpers';

/*
 * 마스터플랜 불변식 — 화면이 바뀌어도 절대 깨지면 안 되는 것들.
 *   §0  발견자는 최소정보만 본다 · 안정적 환자 식별자 없음
 *   §5  토큰/의료정보를 로컬 저장소·로그에 남기지 않는다
 *   §7  119 는 어느 화면에서도 한 번에 닿는다
 */
test('모든 화면에 119 전화가 살아 있다', async ({ page }) => {
  await page.goto('/');
  await expect119Reachable(page);

  await clickBelowDock(page, /응급처치/);
  await expect119Reachable(page);

  await enterByFragment(page, 'ticket', DEMO.cpr);
  await expect(page.getByRole('region', { name: '응급 최소정보' })).toBeVisible();
  await expect119Reachable(page);
});

test('브라우저 저장소에 아무것도 쓰지 않는다 (§5)', async ({ page }) => {
  await enterByFragment(page, 'ticket', DEMO.cpr);
  await expect(page.getByRole('region', { name: '응급 최소정보' })).toBeVisible();

  const stored = await page.evaluate(() => ({
    local: Object.keys(localStorage),
    session: Object.keys(sessionStorage),
    cookie: document.cookie,
  }));
  expect(stored.local, 'localStorage 에 값이 남았다').toEqual([]);
  expect(stored.session, 'sessionStorage 에 값이 남았다').toEqual([]);
  expect(stored.cookie, 'cookie 가 남았다').toBe('');
});

test('콘솔에 토큰·의료정보를 흘리지 않는다 (§5 로그 마스킹)', async ({ page }) => {
  const logs: string[] = [];
  page.on('console', (m) => logs.push(m.text()));

  await enterByFragment(page, 'ticket', DEMO.cpr);
  await expect(page.getByRole('region', { name: '응급 최소정보' })).toBeVisible();

  const joined = logs.join('\n');
  expect(joined).not.toContain(DEMO.cpr);
  expect(joined).not.toContain('페니실린');
});

test('발견자에게 금지된 항목이 노출되지 않는다 (§7 #8)', async ({ page }) => {
  await enterByFragment(page, 'ticket', DEMO.cpr);
  await expect(page.getByRole('region', { name: '응급 최소정보' })).toBeVisible();
  await expectNoForbiddenLabels(page);
});

test('DEMO 고지가 모든 화면에 유지된다', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('note')).toContainText(/가상 환자|DEMO/);

  await enterByManualCode(page, DEMO.cpr);
  await expect(page.getByRole('note').first()).toContainText(/가상 환자|DEMO/);
});
