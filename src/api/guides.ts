// Guide list follows MEDIVC_MASTER_PLAN §4 "GET /v1/guides" (P0, public).
// Content is served by backend in production; this mock enumerates the
// initial curated set based on 소방청 119 생활응급처치 매뉴얼.
//
// **콘텐츠 정책 (2026-08-31 개정)**
//  · 원문 PDF 를 그대로 재배포하지 않고, 사실·절차만 자체 표현으로 요약한 뒤
//    앱 UI 컴포넌트로 렌더한다.
//  · 원문 자체는 public/guides/*.pdf 로 번들되어 있어 토글에서 "PDF 로 상세보기"
//    로 대체 확인 가능하다.
//  · §10 "생성형 AI가 응급처치 내용을 만들지 않는다" 원칙 — 본 요약은 원문의
//    사실적·절차적 정보를 자체 표현으로 정리한 것이며, 임상 판단이 아니다.
//    최종 판단은 원문 및 119 지시가 우선한다.
//
// TODO: 실서비스 전환 시 백엔드 `/v1/guides/{slug}` 로 이관, 콘텐츠팀·의료검수
// 승인 흐름 붙이기.

export interface GuideQuickCheck {
  when: string;
  then: string;
}

export interface GuideStep {
  title: string;
  detail?: string;
  caution?: string;
}

export interface GuideSection {
  heading: string;
  intro?: string;
  steps?: GuideStep[];
  bullets?: string[];
}

export interface GuideContent {
  lede: string;
  quickChecks?: GuideQuickCheck[];
  sections: GuideSection[];
  criticalWarnings?: string[];
}

export interface GuideItem {
  slug: string;
  title: string;
  source: string;
  /** 원문 PDF (사용자 상세보기용 참조. 앱은 요약 UI 를 표시하고 PDF 는 토글에서 열림) */
  pdfPath: string;
  license: string;
  content: GuideContent;
}

const CPR: GuideItem = {
  slug: 'cpr-adult',
  title: '심폐소생술 (CPR)',
  source: '소방청 119 생활응급처치 매뉴얼',
  pdfPath: '/guides/cpr.pdf',
  license: '소방청 공공저작물 · 출처표시',
  content: {
    lede: '심장이 멈춘 사람을 발견했을 때의 기본 인명 구조 순서. 훈련되지 않았다면 인공호흡 없이 가슴 압박만 이어가도 됩니다.',
    sections: [
      {
        heading: '의식 확인',
        steps: [
          {
            title: '어깨를 가볍게 두드리며 큰 소리로 반응을 확인합니다.',
            caution: '지나치게 흔들면 목뼈가 다칠 수 있어요.',
          },
        ],
      },
      {
        heading: '119 신고 · 자세 바로잡기',
        steps: [
          {
            title: '반응이 없으면 즉시 119 에 신고합니다.',
            detail: '옆에 사람이 있으면 대신 신고를 부탁합니다.',
          },
          {
            title: '엎드려 있다면 통나무 굴리기법으로 바로 눕힙니다.',
            detail: '머리와 몸통을 한꺼번에 돌려 목뼈 손상을 막습니다.',
          },
        ],
      },
      {
        heading: '기도 확보',
        steps: [
          {
            title: '머리를 뒤로 젖히고 턱을 들어 기도를 엽니다.',
            caution: '사고로 목 부상이 의심되면 턱만 살짝 들어올리세요.',
          },
        ],
      },
      {
        heading: '가슴 압박',
        intro: '기도 확보 후 호흡이 없거나 정상이 아니면 즉시 시작합니다.',
        bullets: [
          '가슴 중앙에 손바닥 아랫부분을 대고 다른 손을 겹칩니다.',
          '팔꿈치를 편 채 체중으로 눌러 약 5cm 깊이로 압박합니다.',
          '분당 100–120회 속도로, 매 압박 후 가슴이 완전히 올라오게 합니다.',
        ],
      },
      {
        heading: '인공호흡 · 반복',
        intro: '훈련되어 있고 가능하다면 가슴 압박 30회 후 인공호흡 2회를 반복합니다. 자신 없으면 압박만 계속합니다.',
        bullets: [
          '기도 확보 후 코를 막고 입 대 입으로 1초씩 2회 불어넣습니다.',
          '가슴이 부풀어 오르는지 확인합니다.',
          '119 도착 또는 환자 회복 시까지 30:2 사이클을 이어갑니다.',
        ],
      },
    ],
    criticalWarnings: [
      '아이는 압박 깊이를 4cm 정도로 줄이고, 영아는 두 손가락 또는 두 엄지 감싸안기법을 사용합니다.',
      '주변 사람이 없을 때는 스피커폰으로 119 상담사의 안내를 받으며 진행할 수 있습니다.',
    ],
  },
};

const HEIMLICH: GuideItem = {
  slug: 'airway-obstruction',
  title: '기도 폐쇄 · 하임리히',
  source: '소방청 119 생활응급처치 매뉴얼',
  pdfPath: '/guides/heimlich.pdf',
  license: '소방청 공공저작물 · 출처표시',
  content: {
    lede: '이물질로 숨길이 막힌 응급 상황. 완전 폐쇄와 부분 폐쇄에 대응이 다릅니다.',
    quickChecks: [
      {
        when: '기침하고 말할 수 있음 (부분 폐쇄)',
        then: '계속 기침하도록 격려. 이물질이 안 나오면 119.',
      },
      {
        when: '말 못하고 양손으로 목을 잡음 · 얼굴이 파랗게 변함 (완전 폐쇄)',
        then: '즉시 아래 복부 밀쳐 올리기 시작.',
      },
    ],
    sections: [
      {
        heading: '의식 있는 성인 · 복부 밀쳐 올리기',
        steps: [
          { title: '환자 뒤로 돌아가 두 팔로 허리를 감쌉니다.' },
          {
            title: '한 손은 주먹을 쥐어 배꼽과 명치 사이 중간에 댑니다.',
            detail: '엄지 쪽이 배에 닿도록 주먹을 눕혀 놓습니다.',
          },
          {
            title: '다른 손으로 주먹을 감싸 안쪽 · 위쪽으로 강하게 밀어 올립니다.',
            detail: '이물질이 나오거나 환자가 호흡을 되찾을 때까지 반복합니다.',
          },
        ],
      },
      {
        heading: '의식이 없어진 경우',
        bullets: [
          '즉시 119 신고 (아직이라면).',
          '심폐소생술 절차로 전환 — 가슴 압박 시작.',
          '인공호흡 전마다 입 안에 보이는 이물질이 있는지 확인하고 있으면 빼냅니다.',
        ],
      },
      {
        heading: '영아 (1세 미만)',
        intro: '영아는 복부 밀치기를 하지 않습니다. 장기 손상 위험이 있습니다.',
        steps: [
          {
            title: '얼굴이 아래를 향하도록 팔에 엎어 눕히고 등을 5회 두드립니다.',
          },
          {
            title: '뒤집어 젖꼭지 아래에 두 손가락을 대고 가슴 압박 5회.',
          },
          { title: '이물질이 나올 때까지 위 두 단계를 반복합니다.' },
        ],
      },
    ],
    criticalWarnings: [
      '영아에게는 절대 복부 밀치기(하임리히)를 하지 마세요.',
      '이물질이 잘 보이지 않으면 손가락으로 입안을 훑지 마세요 — 더 깊이 밀려 들어갈 수 있습니다.',
    ],
  },
};

const BLEEDING: GuideItem = {
  slug: 'bleeding',
  title: '출혈 응급처치',
  source: '소방청 119 생활응급처치 매뉴얼',
  pdfPath: '/guides/bleeding.pdf',
  license: '소방청 공공저작물 · 출처표시',
  content: {
    lede: '출혈이 심하면 즉시 압박하고 상처 부위를 심장보다 높게 유지합니다. 물이나 음식을 주지 않습니다 (수술 가능성).',
    quickChecks: [
      { when: '출혈이 심함', then: '손으로 상처를 계속 압박.' },
      {
        when: '쇼크 증상 (창백 · 식은땀 · 얕은 호흡)',
        then: '다리와 발을 지면에서 15–30cm 높이기. 호흡이 나빠지면 상체를 세웁니다.',
      },
      {
        when: '신체 일부가 절단됨',
        then: '절단 부위를 찾아 깨끗한 천에 감싸 함께 이송.',
      },
      { when: '구토', then: '옆으로 눕혀 기도를 확보.' },
      {
        when: '이물질이 상처에 박혀 있음',
        then: '절대 뽑지 않습니다. 주변만 고정.',
      },
    ],
    sections: [
      {
        heading: '① 직접 압박법',
        intro: '가장 먼저 시도할 지혈 방법입니다.',
        bullets: [
          '깨끗한 붕대 · 거즈 · 손으로 상처를 직접 강하게 누릅니다.',
          '피가 배어 나와도 붕대를 떼지 말고 위에 덧댑니다.',
          '가능하면 상처 부위를 심장보다 높게 유지합니다.',
        ],
      },
      {
        heading: '② 동맥점 압박',
        intro: '직접 압박으로도 지혈이 안 될 때, 상처보다 몸통에 가까운 동맥을 누릅니다.',
        bullets: [
          '팔에서 나는 피 — 위팔(상완) 안쪽 동맥을 누릅니다.',
          '다리에서 나는 피 — 사타구니 동맥을 누릅니다.',
        ],
      },
      {
        heading: '③ 지혈대 (최후 수단)',
        intro: '위 두 방법이 실패했고 생명이 위험한 경우에만 사용합니다. 심각한 합병증이 생길 수 있습니다.',
        bullets: [
          '폭이 넓고 평평한 것으로 감습니다.',
          '밧줄 · 철사처럼 폭이 좁은 것은 신경 · 혈관을 손상시킵니다.',
          '적용 시각을 기록해 응급대원에게 알립니다.',
        ],
      },
    ],
    criticalWarnings: [
      '출혈 환자에게 물이나 음식을 주지 마세요. 수술이 필요할 수 있습니다.',
      '박혀 있는 이물질은 절대 뽑지 마세요 — 뽑는 순간 대량 출혈이 시작될 수 있습니다.',
    ],
  },
};

const MOCK_GUIDES: GuideItem[] = [CPR, HEIMLICH, BLEEDING];

export async function fetchGuides(): Promise<GuideItem[]> {
  await new Promise((r) => setTimeout(r, 150));
  return MOCK_GUIDES;
}

export function findGuide(slug: string): GuideItem | undefined {
  return MOCK_GUIDES.find((g) => g.slug === slug);
}
