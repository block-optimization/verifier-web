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
 */
const CORE_SCRIPT = [
  '환자가 있습니다.',
  '의식이 없고 숨을 쉬지 않습니다.',
  '의식이 없지만 숨은 쉬고 있습니다.',
  '나이와 지병은 모르겠습니다.',
  '제 이름은',
  '스피커폰으로 바꿨습니다.',
];

test('6단계 대본 문장이 그대로 화면에 있다', async ({ page }) => {
  await mockReverseGeocode(page);
  await grantLocation(page);
  await enterByFragment(page, 'card', CARD_REFS.alpha);
  await expectCommonFinderScreen(page);

  for (const line of CORE_SCRIPT) {
    await expect(page.getByText(line, { exact: false }).first(), `대본 문장 누락: ${line}`).toBeVisible();
  }
});

test('확인된 주소가 대본 문장 안에 들어간다', async ({ page }) => {
  await mockReverseGeocode(page);
  await grantLocation(page);
  await enterByFragment(page, 'card', CARD_REFS.alpha);

  // 위치 카드의 표시용 주소가 아니라, 읽을 수 있는 한 문장으로 나와야 한다.
  await expect(page.getByText('서울특별시 중구 세종대로 110입니다.')).toBeVisible();
  // 주소 한 줄로는 환자 앞까지 못 온다 — 동·호·층을 덧붙일 자리를 상황별로 연다.
  await expect(page.getByText('◯◯◯동 ◯◯◯호입니다.')).toBeVisible();
  await expect(page.getByText('◯층 ◯◯◯호입니다.')).toBeVisible();
  await expect(page.getByText('지하 ◯층 주차장입니다.')).toBeVisible();
  // 건물명이 잡혀도 환자가 그 건물 "앞"에 있다고 단정하지 않는다.
  await expect(page.locator('main')).not.toContainText('서울특별시청 건물입니다');
});

test('도로명이 없으면 지번을 문장에 쓴다 — "(지번)" 꼬리표는 읽지 않는다', async ({ page }) => {
  await mockReverseGeocode(page, { jibunAddress: '서울특별시 중구 태평로1가 31' });
  await grantLocation(page);
  await enterByFragment(page, 'card', CARD_REFS.alpha);

  await expect(page.getByText('서울특별시 중구 태평로1가 31입니다.')).toBeVisible();
});

test('산악이면 국가지점번호 문장을 덧붙인다', async ({ page }) => {
  await mockReverseGeocode(page, {
    jibunAddress: '강원특별자치도 인제군 북면 용대리 산 12',
    isMountainous: true,
  });
  await grantLocation(page);
  await enterByFragment(page, 'card', CARD_REFS.alpha);

  await expect(page.getByText('국가지점번호 ◯◯ ◯◯◯◯ ◯◯◯◯입니다.')).toBeVisible();
  await expect(page.getByText('가장 가까운 등산로 입구는 ◯◯◯입니다.')).toBeVisible();
});

test('주소를 못 잡으면 모른다고 말하는 문장을 준다', async ({ page }) => {
  await mockReverseGeocode(page, { status: 503 });
  await enterByFragment(page, 'card', CARD_REFS.alpha);
  await expectCommonFinderScreen(page);

  await expect(page.getByText('정확한 주소는 모르겠습니다.', { exact: false })).toBeVisible();
  // 소방청이 안내하는 대체 수단을 문장으로 펼쳐 둔다.
  await expect(page.getByText('전봇대 번호는 ◯◯◯◯◯◯◯◯입니다.')).toBeVisible();
  await expect(page.getByText('◯◯고속도로 ◯◯◯킬로미터 지점입니다.')).toBeVisible();
  // 나머지 단계의 대본은 위치와 무관하게 그대로 있어야 한다.
  await expect(page.getByText('환자가 있습니다.').first()).toBeVisible();
});
