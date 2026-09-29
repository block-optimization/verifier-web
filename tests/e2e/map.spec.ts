import { expect, test } from '@playwright/test';
import {
  CARD_REFS,
  enterByFragment,
  grantLocation,
  mockReverseGeocode,
  stubNaverMaps,
} from './helpers';

/*
 * 위치 카드의 "지도로 보기".
 *
 * 지도를 밀거나 축소하면 환자가 있는 지점을 다시 찾기 어렵다 — 되돌릴 방법이
 * 화면에 있어야 한다. 실제 Naver SDK 대신 stub 을 세워 호출만 확인한다.
 */
test.beforeEach(async ({ page }) => {
  await mockReverseGeocode(page);
  await grantLocation(page);
  await stubNaverMaps(page);
});

async function openMap(page: import('@playwright/test').Page) {
  await enterByFragment(page, 'card', CARD_REFS.alpha);
  await expect(page.getByText('서울특별시 중구 세종대로 110입니다.')).toBeVisible();
  await page.getByText('지도로 보기').click();
}

test('지도를 열면 현재 위치로 돌아가는 버튼이 지도 위에 있다', async ({ page }) => {
  await openMap(page);

  const recenter = page.getByRole('button', { name: '현재 위치' });
  await expect(recenter).toBeVisible();

  // 지도 영역 안, 오른쪽 아래에 얹혀 있어야 한다.
  const map = await page.locator('.map-frame').boundingBox();
  const btn = await recenter.boundingBox();
  expect(map && btn).toBeTruthy();
  if (!map || !btn) return;
  expect(btn.x).toBeGreaterThan(map.x + map.width / 2);
  expect(btn.y).toBeGreaterThan(map.y + map.height / 2);
  expect(btn.x + btn.width).toBeLessThanOrEqual(map.x + map.width + 1);
  // 손가락으로 누를 수 있는 크기는 유지한다.
  expect(btn.height).toBeGreaterThanOrEqual(32);
});

test('버튼을 누르면 처음 중심 · 배율로 되돌린다', async ({ page }) => {
  await openMap(page);
  await page.getByRole('button', { name: '현재 위치' }).click();

  const calls = await page.evaluate(() => (window as unknown as { __mapCalls: string[] }).__mapCalls);
  expect(calls).toContain('setZoom:16');
  expect(calls.some((c) => c.startsWith('panTo:37.5665,126.978'))).toBe(true);
});

test('지도를 열어도 119 · 대본은 그대로다', async ({ page }) => {
  await openMap(page);
  await expect(page.getByRole('button', { name: '현재 위치' })).toBeVisible();
  await expect(page.getByText('환자가 있습니다.').first()).toBeVisible();
  await expect(page.getByRole('link', { name: /119/ }).first()).toHaveAttribute('href', 'tel:119');
});
