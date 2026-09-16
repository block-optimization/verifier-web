import { useCallback, useState } from 'react';
import { EmergencyReport } from './screens/EmergencyReport';
import { Guide } from './screens/Guide';

// verifier-web은 더 이상 QR/카드별 개인 정보를 조회하지 않는다(백엔드가 발견자용
// 공개 조회 API를 폐지함, 2026-09-16). 발견자는 누가 어떤 QR로 들어오든 똑같이
// 이 화면 하나(119 신고 도움)로 들어온다 — 환자별로 다른 데이터를 가져올 게 없다.

// 팔찌 QR은 `#card=<opaque-reference>` (레거시 `#t=`/`#ticket=`도 존재)를 붙여
// 이 페이지를 연다. 이 웹은 그 값으로 환자를 구분하지 않으므로 내용을 읽거나
// 분기하지 않고, 주소창·브라우저 히스토리에서만 blind 하게 제거한다 — 분석
// 도구나 오류 수집기가 전체 URL을 긁어가도 참조값이 남지 않게 하기 위해서다.
// 렌더 전에(모듈 최초 평가 시점) 실행해 화면에 fragment가 노출되지 않게 한다.
if (typeof window !== 'undefined' && window.location.hash) {
  history.replaceState(null, '', window.location.pathname + window.location.search);
}

type Screen = 'report' | 'guide';

export function App() {
  const [screen, setScreen] = useState<Screen>('report');

  const openGuide = useCallback(() => setScreen('guide'), []);
  const closeGuide = useCallback(() => setScreen('report'), []);

  return screen === 'guide' ? (
    <Guide onBack={closeGuide} />
  ) : (
    <EmergencyReport onOpenGuide={openGuide} />
  );
}
