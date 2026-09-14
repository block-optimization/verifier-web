import { expect, test } from '@playwright/test';
import { FAILURE, clickBelowDock, enterByManualCode, expect119Reachable, expectNoForbiddenLabels } from './helpers';

/*
 * 실패 상태 — 마스터플랜 §7 #7
 *   "검증 실패 시 의료정보를 표시하지 않되 119 버튼은 유지한다"
 *
 * 이게 이 앱에서 가장 중요한 불변식이다. 어떤 실패든 PHI 가 새면 안 되고,
 * 발견자가 119 로 갈 길은 항상 열려 있어야 한다.
 */
const CASES = [
  { code: FAILURE.expired, name: '만료', expect: /만료/ },
  { code: FAILURE.revoked, name: '철회', expect: /철회/ },
  { code: FAILURE.tampered, name: '변조', expect: /손상|변조/ },
  { code: FAILURE.rateLimited, name: 'Rate limit', expect: /다시 시도/ },
];

for (const c of CASES) {
  test(`${c.name}: 의료정보를 렌더하지 않고 119 는 유지한다`, async ({ page }) => {
    await enterByManualCode(page, c.code);

    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByRole('alert')).toContainText(c.expect);

    // PHI 가 담긴 영역 자체가 없어야 한다.
    await expect(page.getByRole('region', { name: '응급 최소정보' })).toHaveCount(0);
    // mock 페르소나의 실제 값이 새지 않았는지 직접 확인.
    await expect(page.locator('body')).not.toContainText('페니실린');
    await expect(page.locator('body')).not.toContainText('항응고제');

    await expect119Reachable(page);
    await expectNoForbiddenLabels(page);
  });
}

test('실패 화면에서도 응급처치 가이드로 갈 수 있다', async ({ page }) => {
  await enterByManualCode(page, FAILURE.expired);
  await clickBelowDock(page, /응급처치/);
  await expect(page.getByRole('region', { name: /가이드|원문/ })).toBeVisible();
  await expect119Reachable(page);
});
