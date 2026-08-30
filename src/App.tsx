import { useCallback, useEffect, useState } from 'react';
import { Landing } from './screens/Landing';
import { Verifying } from './screens/Verifying';
import { EmergencyInfo } from './screens/EmergencyInfo';
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
  | { kind: 'info'; data: EmergencyAccessResponse }
  | { kind: 'error'; error: AccessError };

type Screen = BaseScreen | { kind: 'guide'; from: BaseScreen };

function readTokenFromHash(): string | null {
  const match = window.location.hash.match(/#t=([^&]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export function App() {
  const [screen, setScreen] = useState<Screen>({ kind: 'landing' });

  const startVerification = useCallback((req: AccessRequest) => {
    setScreen({ kind: 'verifying', req });
  }, []);

  const openGuide = useCallback(() => {
    setScreen((s) => (s.kind === 'guide' ? s : { kind: 'guide', from: s }));
  }, []);

  const closeGuide = useCallback(() => {
    setScreen((s) => (s.kind === 'guide' ? s.from : s));
  }, []);

  // §5 보안 수용 기준: fragment 토큰은 body로 교환하고 URL/히스토리에서 제거.
  useEffect(() => {
    const token = readTokenFromHash();
    if (!token) return;
    history.replaceState(null, '', window.location.pathname);
    startVerification({ qrTicket: token });
  }, [startVerification]);

  useEffect(() => {
    if (screen.kind !== 'verifying') return;
    let cancelled = false;
    (async () => {
      try {
        const data = await requestEmergencyAccess(screen.req);
        if (!cancelled) setScreen({ kind: 'info', data });
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
    case 'info':
      return (
        <EmergencyInfo
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
