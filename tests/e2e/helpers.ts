import { expect, type Page } from '@playwright/test';

/*
 * 공용 테스트 도우미 — FE 수정요청서(2026-09-20) 기준.
 *
 * 이 웹은 환자를 구분하지 않는다. QR 의 `card` 참조값은 읽지도, 보내지도 않으므로
 * 테스트에도 "페르소나"가 없다. 아래 참조값들은 서로 다른 팔찌로 들어와도 화면이
 * 같아야 한다는 것을 보이기 위한 임의의 opaque 문자열일 뿐이다.
 */
export const CARD_REFS = {
  alpha: 'Zk8Qv2Tn6Lr4Ws0Xy7Bd',
  beta: 'Pm3Hc9Jf1Ng5Vt8Kq2Rz',
} as const;

/** 폐지된 공개 환자조회 API — 호출이 0회여야 한다 (요청서 「구현 요청」 6항). */
export const RETIRED_PATIENT_API = /\/api\/public\/v1\/(card-sessions|emergency-access)|report-complete/;

/**
 * 발견자 화면에 절대 나오면 안 되는 문구.
 * 환자 개인정보 + "확인했다"고 주장하는 표현 (요청서 「보안 및 기록 기준」).
 */
export const FORBIDDEN_TEXT = [
  '주민등록번호',
  '주민번호',
  '보호자 연락처',
  '카드 인증 완료',
  '환자 확인 완료',
  '카드가 철회',
  '철회된 카드',
];

/** 기본 위치 mock — 서울시청. 백엔드 계약과 같은 필드 이름을 쓴다. */
export const SEOUL_CITY_HALL = {
  roadAddress: '서울특별시 중구 세종대로 110',
  jibunAddress: '서울특별시 중구 태평로1가 31',
  buildingName: '서울특별시청',
  isMountainous: false,
} as const;

/** QR 스캔 진입 — fragment 로 들어온 상황을 재현한다. */
export async function enterByFragment(page: Page, key: 'card' | 'ticket' | 't', value: string) {
  await page.goto(`/#${key}=${value}`);
}

/**
 * 역지오코딩 응답을 고정한다.
 * 실 백엔드는 위치·네트워크에 따라 값이 달라져 단언이 흔들린다.
 * `status` 를 주면 실패(503 등) 를 재현한다.
 */
export async function mockReverseGeocode(
  page: Page,
  body: Record<string, unknown> | { status: number } = SEOUL_CITY_HALL,
) {
  await page.route('**/api/public/v1/location/reverse-geocode', async (route) => {
    if ('status' in body && typeof body.status === 'number') {
      await route.fulfill({ status: body.status, body: '' });
      return;
    }
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });
}

/** 위치 권한 허용 + 좌표 고정. accuracy 를 좋게 줘서 refine 루프를 건너뛴다. */
export async function grantLocation(page: Page, accuracy = 8) {
  await page.context().grantPermissions(['geolocation']);
  await page.context().setGeolocation({ latitude: 37.5665, longitude: 126.978, accuracy });
}

/** Geolocation 자체를 갈아끼운다 — TIMEOUT · 미지원처럼 권한으로는 못 만드는 상태용. */
export async function stubGeolocation(page: Page, kind: 'timeout' | 'unsupported') {
  await page.addInitScript((k: string) => {
    if (k === 'unsupported') {
      Object.defineProperty(navigator, 'geolocation', { value: undefined, configurable: true });
      return;
    }
    const fail = (_ok: unknown, err?: (e: unknown) => void) => {
      err?.({ code: 3, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 });
      return 0;
    };
    Object.defineProperty(navigator, 'geolocation', {
      value: { getCurrentPosition: fail, watchPosition: fail, clearWatch: () => {} },
      configurable: true,
    });
  }, kind);
}

/** 어느 화면이든 119 전화 버튼이 살아 있어야 한다 (요청서 「완료 확인」). */
export async function expect119Reachable(page: Page) {
  const call = page.getByRole('link', { name: /119/ }).first();
  await expect(call).toBeVisible();
  await expect(call).toHaveAttribute('href', 'tel:119');
}

/** 발견자 공통 안내 화면에 도착했는지 — 환자별 분기가 없으므로 이 하나뿐이다. */
export async function expectCommonFinderScreen(page: Page) {
  await expect(page.getByRole('heading', { name: '응급상황인가요?' })).toBeVisible();
  await expect(page.getByRole('region', { name: '신고 순서' })).toBeVisible();
  await expect119Reachable(page);
}

/** 화면 어디에도 금지 문구가 없어야 한다. */
export async function expectNoForbiddenText(page: Page) {
  const body = await page.locator('body').innerText();
  for (const label of FORBIDDEN_TEXT) {
    expect(body, `금지 문구 "${label}" 이 화면에 노출됨`).not.toContain(label);
  }
}

/**
 * 하단 고정 dock 아래에 깔린 버튼을 누른다.
 *
 * 119 dock 은 position:fixed 라 초기 스크롤 위치에서 페이지 끝 요소를 덮는다.
 * `.page` 의 padding-bottom 이 스크롤 여유를 확보해 두므로, 실제 사용자는
 * 스크롤해서 누른다. 테스트도 같은 경로를 밟아야 한다.
 */
export async function clickBelowDock(page: Page, name: RegExp | string) {
  const target = page.getByRole('button', { name });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(target).toBeVisible();
  await target.click();
}
