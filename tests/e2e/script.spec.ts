import { expect, test } from '@playwright/test';
import {
  CARD_REFS,
  enterByFragment,
  expectCommonFinderScreen,
  grantLocation,
  mockReverseGeocode,
} from './helpers';

/*
 * 신고 대본 — 소방청 「119 구급신고 요령」 6단계의 예시 문장을 그대로 읽을 수 있는
 * 형태로 준다. 단계 제목만 있고 문장이 없으면 당황한 발견자가 직접 문장을 조립해야
 * 한다. 그래서 "무엇을 말할지"가 아니라 "뭐라고 말할지"가 화면에 있어야 한다.
 *
 * 동시에 고를 것을 늘리지 않는다. 위치는 역지오코딩 결과로 화면이 판단해 해당
 * 상황 하나만 보여주고, 판단할 수 없는 환자 상태는 빈칸 한 문장으로 받는다.
 */
const CORE_SCRIPT = [
  '환자가 있습니다.',
  '지금 ◯◯◯ 상태입니다.',
  '나이와 지병은 모르겠습니다.',
];

test('6단계 대본 문장이 그대로 화면에 있다', async ({ page }) => {
  await mockReverseGeocode(page);
  await grantLocation(page);
  await enterByFragment(page, 'card', CARD_REFS.alpha);
  await expectCommonFinderScreen(page);

  for (const line of CORE_SCRIPT) {
    await expect(page.getByText(line, { exact: false }).first(), `대본 문장 누락: ${line}`).toBeVisible();
  }

  // 5 · 6단계(이름 · 연락처, 의료지도)는 상담원이 먼저 묻는 것이라 대본에서 뺐다.
  // 대신 "끊지 말라"는 한 문장만 남는다.
  await expect(page.getByText(/전화를 끊지 마세요/)).toBeVisible();
  await expect(page.locator('main')).not.toContainText('제 이름은 ◯◯◯입니다');
});

test('환자 상태는 상황을 나열하지 않고 빈칸 한 문장으로 받는다', async ({ page }) => {
  await mockReverseGeocode(page);
  await grantLocation(page);
  await enterByFragment(page, 'card', CARD_REFS.alpha);
  await expectCommonFinderScreen(page);

  await expect(page.getByText('지금 ◯◯◯ 상태입니다.')).toBeVisible();
  // 의식 · 호흡 조합을 미리 늘어놓지 않는다 — 자기 경우를 찾는 데 시간이 든다.
  await expect(page.locator('main')).not.toContainText('의식이 없지만 숨은 쉬고 있습니다');
});

test('확인된 주소가 대본 문장 안에 들어간다', async ({ page }) => {
  await mockReverseGeocode(page);
  await grantLocation(page);
  await enterByFragment(page, 'card', CARD_REFS.alpha);

  // 위치 카드의 표시용 주소가 아니라, 읽을 수 있는 한 문장으로 나와야 한다.
  await expect(page.getByText('서울특별시 중구 세종대로 110입니다.')).toBeVisible();
  // 건물명이 잡혀도 환자가 그 건물 "앞"에 있다고 단정하지 않는다.
  await expect(page.locator('main')).not.toContainText('서울특별시청 건물입니다');
});

/*
 * 위치 상황은 화면이 고른다 — 발견자에게 전 상황을 나열해 고르게 하지 않는다.
 */
test('일반 건물이면 층 · 호실만 묻는다', async ({ page }) => {
  await mockReverseGeocode(page); // buildingName: 서울특별시청
  await grantLocation(page);
  await enterByFragment(page, 'card', CARD_REFS.alpha);

  await expect(page.getByText('◯층 ◯◯◯호입니다.')).toBeVisible();
  await expect(page.locator('main')).not.toContainText('◯◯◯동 ◯◯◯호입니다');
  await expect(page.locator('main')).not.toContainText('국가지점번호');
});

test('아파트면 동 · 호수를 묻는다', async ({ page }) => {
  await mockReverseGeocode(page, {
    roadAddress: '서울특별시 노원구 상계로 100',
    buildingName: '상계주공아파트',
  });
  await grantLocation(page);
  await enterByFragment(page, 'card', CARD_REFS.alpha);

  await expect(page.getByText('◯◯◯동 ◯◯◯호입니다.')).toBeVisible();
  await expect(page.locator('main')).not.toContainText('◯층 ◯◯◯호입니다');
});

test('건물명이 없으면 실외로 보고 눈에 띄는 것을 묻는다', async ({ page }) => {
  await mockReverseGeocode(page, { roadAddress: '서울특별시 중구 세종대로 110' });
  await grantLocation(page);
  await enterByFragment(page, 'card', CARD_REFS.alpha);

  await expect(page.getByText('근처에 ◯◯◯가 보입니다.')).toBeVisible();
  await expect(page.locator('main')).not.toContainText('◯층 ◯◯◯호입니다');
});

test('산이면 국가지점번호만 묻는다', async ({ page }) => {
  await mockReverseGeocode(page, {
    jibunAddress: '강원특별자치도 인제군 북면 용대리 산 12',
    isMountainous: true,
  });
  await grantLocation(page);
  await enterByFragment(page, 'card', CARD_REFS.alpha);

  await expect(page.getByText('국가지점번호 ◯◯ ◯◯◯◯ ◯◯◯◯입니다.')).toBeVisible();
  await expect(page.getByText('가장 가까운 등산로 입구는 ◯◯◯입니다.')).toBeVisible();
  await expect(page.locator('main')).not.toContainText('◯층 ◯◯◯호입니다');
});

test('도로명이 없으면 지번을 문장에 쓴다 — "(지번)" 꼬리표는 읽지 않는다', async ({ page }) => {
  await mockReverseGeocode(page, { jibunAddress: '서울특별시 중구 태평로1가 31' });
  await grantLocation(page);
  await enterByFragment(page, 'card', CARD_REFS.alpha);

  await expect(page.getByText('서울특별시 중구 태평로1가 31입니다.')).toBeVisible();
});

test('주소를 못 잡으면 모른다고 말하는 문장을 준다', async ({ page }) => {
  await mockReverseGeocode(page, { status: 503 });
  await enterByFragment(page, 'card', CARD_REFS.alpha);
  await expectCommonFinderScreen(page);

  await expect(page.getByText('정확한 주소는 모르겠습니다.', { exact: false })).toBeVisible();
  await expect(page.getByText('전봇대 번호는 ◯◯◯◯◯◯◯◯입니다.')).toBeVisible();
  // 덜 흔한 대안은 접어 둔다.
  await expect(page.getByText('◯◯고속도로 ◯◯◯킬로미터 지점입니다.')).toBeHidden();
  // 나머지 단계의 대본은 위치와 무관하게 그대로 있어야 한다.
  await expect(page.getByText('환자가 있습니다.').first()).toBeVisible();
});

test('보이는 상태를 누르면 대사의 빈칸이 채워진다', async ({ page }) => {
  await mockReverseGeocode(page);
  await grantLocation(page);
  await enterByFragment(page, 'card', CARD_REFS.alpha);
  await expectCommonFinderScreen(page);

  await expect(page.getByText('지금 ◯◯◯ 상태입니다.')).toBeVisible();

  await page.getByRole('button', { name: '의식 없음' }).click();
  await expect(page.getByText('지금 의식 없음 상태입니다.')).toBeVisible();

  // 의식이 없으면서 숨도 안 쉬는 조합이 가장 급하다 — 하나만 고르게 하면 안 된다.
  await page.getByRole('button', { name: '숨 안 쉼' }).click();
  await expect(page.getByText('지금 의식 없음, 숨 안 쉼 상태입니다.')).toBeVisible();

  // 다시 누르면 빠지고, 다 빠지면 빈칸으로 돌아온다.
  await page.getByRole('button', { name: '의식 없음' }).click();
  await expect(page.getByText('지금 숨 안 쉼 상태입니다.')).toBeVisible();
  await page.getByRole('button', { name: '숨 안 쉼' }).click();
  await expect(page.getByText('지금 ◯◯◯ 상태입니다.')).toBeVisible();
});

test('고른 상태는 누른 순서가 아니라 목록 순서로 읽힌다', async ({ page }) => {
  await mockReverseGeocode(page);
  await grantLocation(page);
  await enterByFragment(page, 'card', CARD_REFS.alpha);
  await expectCommonFinderScreen(page);

  await page.getByRole('button', { name: '골절' }).click();
  await page.getByRole('button', { name: '경련' }).click();
  // 급한 것부터 읽히도록 화면이 순서를 잡는다.
  await expect(page.getByText('지금 경련, 골절 상태입니다.')).toBeVisible();
});

test('단계 제목 없이 대사와 안내만 남는다', async ({ page }) => {
  await mockReverseGeocode(page);
  await grantLocation(page);
  await enterByFragment(page, 'card', CARD_REFS.alpha);
  await expectCommonFinderScreen(page);

  const main = page.locator('main');
  await expect(main).not.toContainText('라고 먼저 알리기');
  await expect(main).not.toContainText('정확한 위치 말하기');
  await expect(main).not.toContainText('다른 상황이면');
  // 읽을 것과 확인할 것은 남는다.
  await expect(page.getByText('환자가 있습니다.').first()).toBeVisible();
  await expect(page.getByText(/가슴이 오르내리는지/)).toBeVisible();
});
