import type {
  AccessError,
  AccessErrorReason,
  BackendEmergencyAccessResponse,
  EmergencyAccessResponse,
} from '../types';
import { adaptBackendResponse } from './backendAdapter';
import { isAcceptableCode } from './codeFormat';

/*
 * Real backend switch
 *   VITE_USE_REAL_BACKEND=true → POST /api/public/v1/emergency-access
 *                                (Vite proxy 또는 Netlify Edge 를 통과)
 *   미설정 / 그 외              → 아래 mock 페르소나 사용
 *
 * DEV Backend : https://api-175-45-193-221.sslip.io (CORS 미개방, Netlify redirect 로 우회)
 *
 * §0/§5 원칙 준수 : 응답에 안정적 환자 식별자(profileId 등) 미포함, opaque
 *                  accessSessionId 만 반환. 매 조회에 새로 발급.
 */
const USE_REAL_BACKEND = import.meta.env.VITE_USE_REAL_BACKEND === 'true';

export interface AccessRequest {
  cardReference?: string;
  qrTicket?: string;
  manualCode?: string;
}

// -----------------------------------------------------------------------------
// Mock 데모 코드
//
// 발견자 화면은 더 이상 환자별 의료정보를 표시하지 않으므로(§ 119 신고 중심 피봇),
// 페르소나별 데이터 차이를 둘 이유가 없다. 정상 데모 코드 하나(M3D1-7K9Q)와
// 실패 시나리오 트리거 코드만 의미가 있다 (Landing 화면 "테스트용 코드" 참고).
// -----------------------------------------------------------------------------

function buildMockResponse(): EmergencyAccessResponse {
  return {
    accessSessionId: newAccessSessionId(),
    demo: true,
    audience: 'BYSTANDER',
  };
}

// 128-bit URL-safe opaque handle. Real backend must use CSPRNG on the server
// and bind it to the access session TTL / rate-limit bucket.
function newAccessSessionId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function requestEmergencyAccess(
  req: AccessRequest,
): Promise<EmergencyAccessResponse> {
  if (USE_REAL_BACKEND) {
    let res: Response;
    try {
      let presentation = req;
      if (req.cardReference) {
        const exchange = await fetch('/api/public/v1/card-sessions', {
          method: 'POST', cache: 'no-store', referrerPolicy: 'no-referrer',
          headers: { 'content-type': 'application/json', accept: 'application/json' },
          body: JSON.stringify({ cardReference: req.cardReference }),
          signal: AbortSignal.timeout(15_000),
        });
        if (!exchange.ok) throw errorFromStatus(exchange.status);
        const ticket = await exchange.json() as { qrTicket: string };
        presentation = { qrTicket: ticket.qrTicket };
      }
      res = await fetch('/api/public/v1/emergency-access', {
        method: 'POST',
        cache: 'no-store', referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(15_000),
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(presentation),
      });
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'reason' in error) throw error;
      throw makeError('NETWORK');
    }
    if (!res.ok) throw errorFromStatus(res.status);
    // 백엔드는 FHIR records[] 를 반환하지만, 화면은 더 이상 그 내용을 쓰지 않는다.
    const raw = (await res.json()) as BackendEmergencyAccessResponse;
    return adaptBackendResponse(raw);
  }

  await sleep(900 + Math.random() * 500);

  const token = (req.cardReference ?? req.qrTicket ?? req.manualCode ?? '').trim().toUpperCase();
  if (!token) throw makeError('INVALID');

  // Error 재현용 토큰 (테스트 시나리오 트리거).
  if (token === 'M3D1-EXPR') throw makeError('EXPIRED');
  if (token === 'M3D1-REVK') throw makeError('REVOKED');
  if (token === 'M3D1-TAMP') throw makeError('TAMPERED');
  if (token === 'M3D1-RATE') throw makeError('RATE_LIMITED');

  // 형식 체크 — 실 backend 400 응답을 mock 에서 흉내.
  // 허용: 데모 8자 코드(M3D1-7K9Q) · 실서버 10자리 숫자 · 40자 이상 QR 티켓.
  if (!isAcceptableCode(token) && token.length < 16) {
    throw makeError('INVALID');
  }

  // 등록되지 않은 코드도 기본 데모 응답으로 폴백한다 (화면은 코드별로 다르지 않다).
  return buildMockResponse();
}

// "신고 완료" 를 눌렀을 때 서버에 보내는 신호. 서버는 accessSessionId 로 세션을
// 역추적해 보호자에게 문자/알림을 보낸다(발견자에게는 노출하지 않음). 발견자의
// 다음 화면 진입(응급처치 가이드)을 이 호출의 성패로 막지 않는다 — 호출자가
// 실패를 무시하고 항상 진행하도록 설계되어 있다.
export async function completeReport(accessSessionId: string): Promise<void> {
  if (!USE_REAL_BACKEND) {
    await sleep(200);
    return;
  }
  await fetch(
    `/api/public/v1/emergency-access/${encodeURIComponent(accessSessionId)}/report-complete`,
    {
      method: 'POST',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      signal: AbortSignal.timeout(8_000),
    },
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function makeError(reason: AccessErrorReason): AccessError {
  return { reason, message: '이 카드로는 정보를 표시할 수 없습니다' };
}

function errorFromStatus(status: number): AccessError {
  if (status === 429) return makeError('RATE_LIMITED');
  if (status === 410) return makeError('REVOKED');
  // 백엔드는 만료 · 재사용(소비됨) · 존재하지 않음을 모두 401 ACCESS_TICKET_INVALID
  // 로 반환한다. 영구 팔찌의 폐기를 시간 만료라고 단정하지 않는다.
  if (status === 401 || status === 403) return makeError('INVALID');
  if (status === 404 || status === 400 || status === 422) return makeError('INVALID');
  return makeError('NETWORK');
}
