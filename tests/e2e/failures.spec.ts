import { expect, test } from '@playwright/test';
import {
  CARD_REFS,
  clickBelowDock,
  enterByFragment,
  expect119Reachable,
  expectCommonFinderScreen,
  grantLocation,
  mockReverseGeocode,
  stubGeolocation,
} from './helpers';

/*
 * 실패 상태 — FE 수정요청서(2026-09-20) 「완료 확인」 마지막 항목.
 *   "위치 권한 거절·시간 초과·503 에서도 119 안내가 계속 동작한다."
 *
 * 이게 이 앱에서 가장 중요한 불변식이다. 위치는 부가 정보일 뿐이고,
 * 무슨 일이 생겨도 발견자가 119 로 갈 길은 열려 있어야 한다.
 */

test('위치 권한 거절 — 대체 안내와 재시도, 119 는 유지', async ({ page }) => {
  await mockReverseGeocode(page);
  // 권한을 주지 않는다 → PERMISSION_DENIED.
  await enterByFragment(page, 'card', CARD_REFS.alpha);

  await expectCommonFinderScreen(page);
  await expect(page.getByText(/위치 권한이 거부/)).toBeVisible();
  // 주소를 모를 때의 공식 대안(건물 상호 · 전봇대 번호 등)을 안내해야 한다.
  await expect(page.getByText(/전봇대 번호|상호/).first()).toBeVisible();
  await expect(page.getByRole('button', { name: '위치 다시 확인' })).toBeVisible();
});

test('위치 확인 시간 초과 — 119 안내는 계속 동작', async ({ page }) => {
  await mockReverseGeocode(page);
  await stubGeolocation(page, 'timeout');
  await enterByFragment(page, 'card', CARD_REFS.alpha);

  await expectCommonFinderScreen(page);
  await expect(page.getByText(/위치 확인이 오래/)).toBeVisible();
});

test('Geolocation 미지원 브라우저 — 119 안내는 계속 동작', async ({ page }) => {
  await mockReverseGeocode(page);
  await stubGeolocation(page, 'unsupported');
  await enterByFragment(page, 'card', CARD_REFS.alpha);

  await expectCommonFinderScreen(page);
  await expect(page.getByText(/위치 확인을 지원하지 않/)).toBeVisible();
});

test('역지오코딩 503 — 좌표는 있어도 주소 대신 대체 안내', async ({ page }) => {
  await mockReverseGeocode(page, { status: 503 });
  await grantLocation(page);
  await enterByFragment(page, 'card', CARD_REFS.alpha);

  await expectCommonFinderScreen(page);
  await expect(page.getByText(/주소 변환 서버에 연결할 수 없/)).toBeVisible();
});

test('도로명 주소가 없으면 지번으로 대체한다', async ({ page }) => {
  await mockReverseGeocode(page, {
    jibunAddress: '강원특별자치도 인제군 북면 용대리 산 12',
    isMountainous: true,
  });
  await grantLocation(page);
  await enterByFragment(page, 'card', CARD_REFS.alpha);

  await expect(page.getByText(/용대리 산 12 \(지번\)/)).toBeVisible();
  // 산악이면 국가지점번호 안내로 전환된다.
  await expect(page.getByText(/국가지점번호/)).toBeVisible();
  await expect119Reachable(page);
});

test('주소도 지번도 없으면 좌표를 불러주게 한다', async ({ page }) => {
  await mockReverseGeocode(page, {});
  await grantLocation(page);
  await enterByFragment(page, 'card', CARD_REFS.alpha);

  await expect(page.getByText(/좌표 37\.5665/)).toBeVisible();
  await expect119Reachable(page);
});

test('위치가 실패해도 응급처치 가이드로 갈 수 있다', async ({ page }) => {
  await mockReverseGeocode(page, { status: 503 });
  await enterByFragment(page, 'card', CARD_REFS.alpha);
  await expectCommonFinderScreen(page);

  await clickBelowDock(page, /응급처치/);
  await expect(page.getByRole('region', { name: /가이드|원문/ })).toBeVisible();
  await expect119Reachable(page);
});
