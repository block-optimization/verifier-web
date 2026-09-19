import { expect, test } from '@playwright/test';
import {
  CARD_REFS,
  RETIRED_PATIENT_API,
  clickBelowDock,
  enterByFragment,
  expect119Reachable,
  expectCommonFinderScreen,
  expectNoForbiddenText,
  grantLocation,
  mockReverseGeocode,
} from './helpers';

/*
 * 불변식 — 화면이 바뀌어도 절대 깨지면 안 되는 것들.
 * FE 수정요청서(2026-09-20) 「보안 및 기록 기준」 · 「완료 확인」.
 */
test.beforeEach(async ({ page }) => {
  await mockReverseGeocode(page);
  await grantLocation(page);
});

test('모든 화면에 119 전화가 살아 있다', async ({ page }) => {
  await enterByFragment(page, 'card', CARD_REFS.alpha);
  await expectCommonFinderScreen(page);

  await clickBelowDock(page, /응급처치/);
  await expect119Reachable(page);
});

test('폐지된 공개 환자조회 API 를 호출하지 않는다', async ({ page }) => {
  const calls: string[] = [];
  page.on('request', (r) => {
    if (RETIRED_PATIENT_API.test(r.url())) calls.push(`${r.method()} ${r.url()}`);
  });

  await enterByFragment(page, 'card', CARD_REFS.alpha);
  await expectCommonFinderScreen(page);
  await clickBelowDock(page, /응급처치/);

  expect(calls, '폐지된 환자조회 API 를 호출했다').toEqual([]);
});

test('card 참조값을 네트워크로 내보내지 않는다', async ({ page }) => {
  const leaked: string[] = [];
  page.on('request', (r) => {
    const body = r.postData() ?? '';
    if (r.url().includes(CARD_REFS.alpha) || body.includes(CARD_REFS.alpha)) {
      leaked.push(`${r.method()} ${r.url()}`);
    }
  });

  await enterByFragment(page, 'card', CARD_REFS.alpha);
  await expectCommonFinderScreen(page);

  expect(leaked, 'card 참조값이 요청에 실려 나갔다').toEqual([]);
});

test('위치 API 는 진입 시 1회만 호출한다', async ({ page }) => {
  let hits = 0;
  page.on('request', (r) => {
    if (r.url().includes('/location/reverse-geocode')) hits += 1;
  });

  await enterByFragment(page, 'card', CARD_REFS.alpha);
  await expectCommonFinderScreen(page);
  await expect(page.getByText('서울특별시청')).toBeVisible();

  // GPS 는 연속 이벤트를 쏟아낸다. 그때마다 호출하면 안 된다.
  await page.context().setGeolocation({ latitude: 37.5667, longitude: 126.9782, accuracy: 8 });
  await page.waitForTimeout(1_500);

  expect(hits, '역지오코딩이 여러 번 호출됐다').toBe(1);
});

test('브라우저 저장소에 아무것도 쓰지 않는다', async ({ page }) => {
  await enterByFragment(page, 'card', CARD_REFS.alpha);
  await expectCommonFinderScreen(page);

  const stored = await page.evaluate(() => ({
    local: Object.keys(localStorage),
    session: Object.keys(sessionStorage),
    cookie: document.cookie,
  }));
  expect(stored.local, 'localStorage 에 값이 남았다').toEqual([]);
  expect(stored.session, 'sessionStorage 에 값이 남았다').toEqual([]);
  expect(stored.cookie, 'cookie 가 남았다').toBe('');
});

test('콘솔에 card 참조값을 흘리지 않는다', async ({ page }) => {
  const logs: string[] = [];
  page.on('console', (m) => logs.push(m.text()));
  page.on('pageerror', (e) => logs.push(e.message));

  await enterByFragment(page, 'card', CARD_REFS.alpha);
  await expectCommonFinderScreen(page);

  expect(logs.join('\n')).not.toContain(CARD_REFS.alpha);
});

test('환자 정보·인증 완료 문구가 노출되지 않는다', async ({ page }) => {
  await enterByFragment(page, 'card', CARD_REFS.alpha);
  await expectCommonFinderScreen(page);
  await expectNoForbiddenText(page);

  await clickBelowDock(page, /응급처치/);
  await expectNoForbiddenText(page);
});
