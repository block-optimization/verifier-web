// Guide list follows MEDIVC_MASTER_PLAN §4 "GET /v1/guides" (P0, public).
// Content is served by backend in production; this mock enumerates the
// initial curated set from §10 데이터 소스 (질병관리청 · 행정안전부) with
// citation-only rows — no clinical instructions per §10 "생성형 AI가
// 응급처치 내용을 만들지 않는다".
//
// URL 정책
//  · §10 "8/10 Gate 공식 링크" 반영 — 팀이 검증한 실제 딥링크를 사용한다.
//  · 각 항목은 해당 주제의 원문 페이지 (또는 그에 준하는 카테고리) 로 직결한다.
//  · 라이선스는 공공누리 제1유형 (출처표시) 기준으로 표기한다.
//
// TODO: 실서비스 전환 시 백엔드 `/v1/guides/{slug}` 로 이관하여 개정일·버전을
// 서버에서 관리하고, 링크 부패 감시(주간 헬스체크)를 붙인다.

export interface GuideItem {
  slug: string;
  title: string;
  source: string;
  revisionYear: number;
  officialUrl: string;
  license: string;
}

const MOCK_GUIDES: GuideItem[] = [
  {
    slug: 'cpr-adult',
    title: '심폐소생술 (CPR)',
    source: '질병관리청 국가건강정보포털',
    revisionYear: 2025,
    officialUrl:
      'https://health.kdca.go.kr/healthinfo/biz/health/gnrlzHealthInfo/gnrlzHealthInfo/gnrlzHealthInfoView.do',
    license: '공공누리 제1유형 · 출처표시',
  },
  {
    slug: 'airway-obstruction',
    title: '기도 폐쇄 · 하임리히',
    source: '질병관리청 국가건강정보포털',
    revisionYear: 2025,
    officialUrl:
      'https://health.kdca.go.kr/healthinfo/biz/health/gnrlzHealthInfo/gnrlzHealthInfo/gnrlzHealthInfoView.do?cntnts_sn=6227',
    license: '공공누리 제1유형 · 출처표시',
  },
  {
    slug: 'first-aid-general',
    title: '응급처치 일반 행동요령',
    source: '행정안전부 국민재난안전포털',
    revisionYear: 2025,
    officialUrl:
      'https://www.safekorea.go.kr/safekorea-kor/acts/nacts/action-guide.do?category=firstAid&actsHeaderTitle=%EC%9D%91%EA%B8%89%EC%B2%98%EC%B9%98&menuSn=4',
    license: '공공누리 제1유형 · 출처표시',
  },
];

export async function fetchGuides(): Promise<GuideItem[]> {
  await new Promise((r) => setTimeout(r, 150));
  return MOCK_GUIDES;
}
