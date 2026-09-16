import { useCallback, useState } from 'react';
import { EmergencyReport } from './screens/EmergencyReport';
import { Guide } from './screens/Guide';

// verifier-web은 더 이상 QR/카드별 개인 정보를 조회하지 않는다(백엔드가 발견자용
// 공개 조회 API를 폐지함, 2026-09-16). 발견자는 누가 어떤 QR로 들어오든 똑같이
// 이 화면 하나(119 신고 도움)로 들어온다 — 환자별로 다른 데이터를 가져올 게 없다.
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
