import { useCallback, useEffect, useRef, useState } from 'react';
import { Landing } from './screens/Landing';
import { Verifying } from './screens/Verifying';
import { EmergencyReport } from './screens/EmergencyReport';
import { ErrorScreen } from './screens/ErrorScreen';
import { Guide } from './screens/Guide';
import {
  requestEmergencyAccess,
  type AccessRequest,
} from './api/emergencyAccess';
import {
  isAccessError,
  type AccessError,
  type EmergencyAccessResponse,
} from './types';

type BaseScreen =
  | { kind: 'landing' }
  | { kind: 'verifying'; req: AccessRequest }
  | { kind: 'report'; data: EmergencyAccessResponse }
  | { kind: 'error'; error: AccessError };

type Screen = BaseScreen | { kind: 'guide'; from: BaseScreen };

/**
 * QR 진입 시 첫 렌더부터 verifying 상태로 시작하기 위한 초기화 함수.
 * §5 보안 수용 기준에 따라 fragment 토큰을 즉시 URL/히스토리에서 제거한다.
 * 이렇게 하면 landing 화면이 잠깐 깜빡이지 않고 곧장 verifying → info 로 이어진다.
 */
function initialScreen(): Screen {
  if (typeof window === 'undefined') return { kind: 'landing' };
  // 백엔드가 발급하는 qrPayload 는 `#ticket=<token>` 형식이고, 마스터플랜 §5 표기와
  // 기존 데모 QR 은 `#t=<token>` 이다. 양쪽 모두 받아들인다.
  const hash = window.location.hash;
  const match = hash.match(/^#(card|ticket|t)=([^&]+)$/);
  if (!match) return { kind: 'landing' };
  history.replaceState(null, '', window.location.pathname);
  try {
    const token = decodeURIComponent(match[2]);
    return { kind: 'verifying', req: match[1] === 'card' ? { cardReference: token } : { qrTicket: token } };
  } catch {
    return { kind: 'error', error: { reason: 'INVALID', message: '올바르지 않은 QR입니다' } };
  }
}

// Read and scrub once, including React StrictMode's repeated initialization.
const entryScreen = initialScreen();

export function App() {
  const [screen, setScreen] = useState<Screen>(entryScreen);
  const pending = useRef<{ req: AccessRequest; promise: Promise<EmergencyAccessResponse> } | null>(null);

  useEffect(() => {
    const scanAgain = () => {
      if (/^#(?:card|ticket|t)=/.test(window.location.hash)) setScreen(initialScreen());
    };
    window.addEventListener('hashchange', scanAgain);
    return () => window.removeEventListener('hashchange', scanAgain);
  }, []);

  const startVerification = useCallback((req: AccessRequest) => {
    setScreen({ kind: 'verifying', req });
  }, []);

  const openGuide = useCallback(() => {
    setScreen((s) => (s.kind === 'guide' ? s : { kind: 'guide', from: s }));
  }, []);

  const closeGuide = useCallback(() => {
    setScreen((s) => (s.kind === 'guide' ? s.from : s));
  }, []);

  useEffect(() => {
    if (screen.kind !== 'verifying') return;
    // Reuse the in-flight request during StrictMode effect replay: never consume twice.
    if (pending.current?.req !== screen.req) {
      pending.current = { req: screen.req, promise: requestEmergencyAccess(screen.req) };
    }
    const promise = pending.current.promise;
    let cancelled = false;
    (async () => {
      try {
        const data = await promise;
        if (!cancelled) setScreen({ kind: 'report', data });
      } catch (err) {
        if (cancelled) return;
        const error: AccessError = isAccessError(err)
          ? err
          : { reason: 'NETWORK', message: '연결 오류' };
        setScreen({ kind: 'error', error });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [screen]);

  switch (screen.kind) {
    case 'landing':
      return <Landing onSubmit={startVerification} onOpenGuide={openGuide} />;
    case 'verifying':
      return <Verifying />;
    case 'report':
      return (
        <EmergencyReport
          data={screen.data}
          onDone={() => setScreen({ kind: 'landing' })}
          onOpenGuide={openGuide}
        />
      );
    case 'error':
      return (
        <ErrorScreen
          error={screen.error}
          onRetry={() => setScreen({ kind: 'landing' })}
          onOpenGuide={openGuide}
        />
      );
    case 'guide':
      return <Guide onBack={closeGuide} />;
  }
}
