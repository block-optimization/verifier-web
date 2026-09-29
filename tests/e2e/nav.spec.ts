import { expect, test } from '@playwright/test';
import {
  CARD_REFS,
  enterByFragment,
  expectCommonFinderScreen,
  grantLocation,
  mockReverseGeocode,
} from './helpers';

/*
 * 하단 고정 바 — 119(왼) · 응급처치 가이드(오른).
 *
 * 가이드로 넘어간 뒤 돌아오려면 위로 스크롤해 상단 뒤로 버튼을 찾아야 했다.
 * 같은 자리에서 돌아올 수 있어야 한다.
 */
test.beforeEach(async ({ page }) => {
  await mockReverseGeocode(page);
  await grantLocation(page);
});

test('하단 바에 119와 응급처치 가이드가 나란히 있다', async ({ page }) => {
  await enterByFragment(page, 'card', CARD_REFS.alpha);
  await expectCommonFinderScreen(page);

  const dock = page.getByRole('region', { name: '상시 응급 도움' });
  const call = dock.getByRole('link', { name: /119/ });
  const guide = dock.getByRole('button', { name: '응급처치 가이드' });
  await expect(call).toBeVisible();
  await expect(guide).toBeVisible();

  // 119 가 왼쪽이다 — 급할 때 엄지가 먼저 닿는 자리.
  const callBox = await call.boundingBox();
  const guideBox = await guide.boundingBox();
  expect(callBox && guideBox).toBeTruthy();
  if (!callBox || !guideBox) return;
  expect(callBox.x).toBeLessThan(guideBox.x);

  // 스크롤 끝에 같은 일을 하는 버튼을 또 두지 않는다.
  await expect(page.getByRole('button', { name: /신고 완료/ })).toHaveCount(0);
});

test('가이드에서 같은 자리의 버튼으로 신고 안내에 돌아온다', async ({ page }) => {
  await enterByFragment(page, 'card', CARD_REFS.alpha);
  await expectCommonFinderScreen(page);

  await page.getByRole('button', { name: '응급처치 가이드' }).click();
  await expect(page.getByRole('region', { name: /가이드|원문/ })).toBeVisible();

  const dock = page.getByRole('region', { name: '상시 응급 도움' });
  await expect(dock.getByRole('link', { name: /119/ })).toBeVisible();
  await dock.getByRole('button', { name: '신고 안내로' }).click();

  await expectCommonFinderScreen(page);
});

test('가이드 상세에서도 신고 안내로 바로 나갈 수 있다', async ({ page }) => {
  await enterByFragment(page, 'card', CARD_REFS.alpha);
  await page.getByRole('button', { name: '응급처치 가이드' }).click();
  await page.getByRole('button', { name: /심폐소생술/ }).first().click();

  await page
    .getByRole('region', { name: '상시 응급 도움' })
    .getByRole('button', { name: '신고 안내로' })
    .click();
  await expectCommonFinderScreen(page);
});
