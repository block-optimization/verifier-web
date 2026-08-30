import type { AccessError, AccessErrorReason, EmergencyAccessResponse } from '../types';

/*
 * Real backend switch
 *   VITE_USE_REAL_BACKEND=true → POST /api/public/v1/emergency-access
 *                                (Vite proxy 또는 same-origin BFF 를 통과)
 *   미설정 / 그 외              → 아래 mock 폴백 (오프라인 · 백엔드 다운 · CI 데모용)
 *
 * DEV Backend (2026-08 기준) : https://34-205-135-30.sslip.io
 *   · CORS 미개방 → 브라우저에서 직접 호출 금지, proxy 필수
 *   · endpoint body : { qrTicket } 또는 { manualCode } 중 하나
 *   · 단회용 ticket · rate limit · generic 실패 응답 규칙은 §5 보안 수용 기준
 *
 * 응답 shape 는 백엔드 OpenAPI 로 확정 시 types.ts 에서 재조정한다.
 * 현재 mock 은 §0/§5 "안정적 환자 식별자 노출 금지" 원칙에 따라
 * `accessSessionId` (opaque, 매 조회마다 신규) 만 반환한다.
 */
const USE_REAL_BACKEND = import.meta.env.VITE_USE_REAL_BACKEND === 'true';

export interface AccessRequest {
  qrTicket?: string;
  manualCode?: string;
}

const usedTickets = new Set<string>();

// Mirrors MEDIVC_MASTER_PLAN §4 default ConsentPolicy for BYSTANDER audience:
//   audiences.BYSTANDER = ["DRUG_ALLERGY", "ANTICOAGULANT_FLAG", "EMERGENCY_NOTE"]
// The server is authoritative — this mock is only intended to represent
// what a policy-filtered response would look like. Fields outside the
// audience's allowlist (BLOOD_TYPE, MEDICATION_SUMMARY, CONDITION, IDENTITY,
// EMERGENCY_CONTACT) must never appear in a BYSTANDER response body.
//
// §0/§5: 응답에 안정적 환자 식별자(profileId 등)를 포함하지 않는다. 후속 액션은
// 매 조회마다 새로 발급되는 opaque accessSessionId 로만 인증한다.
function buildDemoBystanderResponse(): EmergencyAccessResponse {
  return {
    accessSessionId: newAccessSessionId(),
    demo: true,
    audience: 'BYSTANDER',
    policyVersion: 3,
    card: {
      issuer: 'Demo 한국대병원',
      signatureVerified: true,
      expiresAt: '2026-09-30T23:59:59+09:00',
    },
    items: [
      {
        code: 'DRUG_ALLERGY',
        value: '페니실린',
        source: { type: 'DEMO_ISSUER', displayName: '한국대병원' },
        verificationStatus: 'TEST_VERIFIED',
        observedAt: '2026-07-30T00:00:00Z',
      },
      {
        code: 'ANTICOAGULANT_FLAG',
        value: '예',
        source: { type: 'DEMO_ISSUER', displayName: '한국대병원' },
        verificationStatus: 'TEST_VERIFIED',
        observedAt: '2026-07-30T00:00:00Z',
      },
      {
        code: 'EMERGENCY_NOTE',
        value: '오른쪽 팔 의료밴드 확인',
        source: { type: 'USER_ASSERTED' },
        verificationStatus: 'UNVERIFIED',
        observedAt: '2026-07-30T00:00:00Z',
      },
    ],
    emergencyContactPresent: true,
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
      res = await fetch('/api/public/v1/emergency-access', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(req),
      });
    } catch {
      throw makeError('NETWORK');
    }
    if (!res.ok) throw errorFromStatus(res.status);
    return (await res.json()) as EmergencyAccessResponse;
  }

  await sleep(900 + Math.random() * 500);

  const token = (req.qrTicket ?? req.manualCode ?? '').trim().toUpperCase();
  if (!token) throw makeError('INVALID');

  if (token === 'M3D1-EXPR') throw makeError('EXPIRED');
  if (token === 'M3D1-REVK') throw makeError('REVOKED');
  if (token === 'M3D1-TAMP') throw makeError('TAMPERED');
  if (token === 'M3D1-RATE') throw makeError('RATE_LIMITED');

  if (!/^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(token) && token.length < 16) {
    throw makeError('INVALID');
  }

  // Enforce the single-use rule the real backend applies. Same generic
  // error message regardless of cause (per §7 wireframe V4).
  if (usedTickets.has(token)) throw makeError('EXPIRED');
  usedTickets.add(token);
  return buildDemoBystanderResponse();
}

// Triggers a server-mediated call to the patient's emergency contact WITHOUT
// exposing the phone number to the BYSTANDER. Authenticated purely by the
// short-lived opaque accessSessionId so no stable patient identifier crosses
// the wire. Wire to POST /api/public/v1/emergency-contact/dial once available.
export async function callEmergencyContact(_accessSessionId: string): Promise<void> {
  await sleep(300);
  return;
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
  if (status === 404 || status === 400) return makeError('INVALID');
  return makeError('NETWORK');
}
