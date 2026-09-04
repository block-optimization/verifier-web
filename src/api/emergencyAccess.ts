import type {
  AccessError,
  AccessErrorReason,
  EmergencyAccessResponse,
  EmergencyCardMeta,
  EmergencyItem,
} from '../types';

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
  qrTicket?: string;
  manualCode?: string;
}

// -----------------------------------------------------------------------------
// Mock 데모 페르소나
//
// 물리 QR/NFC 키링은 재사용 가능한 물체이므로 같은 token 을 여러 번 스캔해도
// 서버는 매번 그 시점의 최신 정보를 반환하는 게 정상 동작 (마스터플랜 §5 회전·철회
// 는 환자의 능동적 행위, 스캔으로 소진되지 않음). 그래서 mock 도 페르소나 token
// 을 소진하지 않고 매 호출마다 신규 accessSessionId 로 응답한다.
//
// 서로 다른 카드 → 서로 다른 환자 데이터를 보여주기 위한 데모용 세트.
// 실서비스에서는 backend 가 카드/티켓 → 환자 정보 매핑을 관리한다.
// -----------------------------------------------------------------------------
interface DemoPersona {
  card: EmergencyCardMeta;
  items: EmergencyItem[];
  emergencyContactPresent: boolean;
}

const PERSONAS: Record<string, DemoPersona> = {
  'M3D1-7K9Q': {
    card: {
      issuer: 'Demo 한국대병원',
      signatureVerified: true,
      expiresAt: '2026-12-31T23:59:59+09:00',
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
        value: '오른팔에 의료용 밴드 · 최근 치과 시술',
        source: { type: 'USER_ASSERTED' },
        verificationStatus: 'UNVERIFIED',
        observedAt: '2026-08-15T00:00:00Z',
      },
    ],
    emergencyContactPresent: true,
  },

  'M3D2-A1B2': {
    card: {
      issuer: 'Demo 세종병원',
      signatureVerified: true,
      expiresAt: '2027-03-15T23:59:59+09:00',
    },
    items: [
      {
        code: 'DRUG_ALLERGY',
        value: '아스피린 · NSAIDs',
        source: { type: 'DEMO_ISSUER', displayName: '세종병원' },
        verificationStatus: 'TEST_VERIFIED',
        observedAt: '2026-08-02T00:00:00Z',
      },
      {
        code: 'ANTICOAGULANT_FLAG',
        value: '아니오',
        source: { type: 'DEMO_ISSUER', displayName: '세종병원' },
        verificationStatus: 'TEST_VERIFIED',
        observedAt: '2026-08-02T00:00:00Z',
      },
      {
        code: 'EMERGENCY_NOTE',
        value: '천식 · 흡입기 왼쪽 주머니 소지',
        source: { type: 'USER_ASSERTED' },
        verificationStatus: 'UNVERIFIED',
        observedAt: '2026-08-20T00:00:00Z',
      },
    ],
    emergencyContactPresent: true,
  },

  'M3D3-C3D4': {
    card: {
      issuer: 'Demo 성모의료원',
      signatureVerified: true,
      expiresAt: '2027-01-31T23:59:59+09:00',
    },
    items: [
      {
        code: 'DRUG_ALLERGY',
        value: '조영제 · 요오드',
        source: { type: 'DEMO_ISSUER', displayName: '성모의료원' },
        verificationStatus: 'TEST_VERIFIED',
        observedAt: '2026-06-10T00:00:00Z',
      },
      {
        code: 'ANTICOAGULANT_FLAG',
        value: '예 (와파린)',
        source: { type: 'DEMO_ISSUER', displayName: '성모의료원' },
        verificationStatus: 'TEST_VERIFIED',
        observedAt: '2026-06-10T00:00:00Z',
      },
      {
        code: 'EMERGENCY_NOTE',
        value: '왼쪽 가슴 페이스메이커 · MRI 금기',
        source: { type: 'DEMO_ISSUER', displayName: '성모의료원' },
        verificationStatus: 'TEST_VERIFIED',
        observedAt: '2026-06-10T00:00:00Z',
      },
    ],
    emergencyContactPresent: true,
  },

  'M3D4-E5F6': {
    card: {
      issuer: 'Demo 서울대병원',
      signatureVerified: true,
      expiresAt: '2027-06-30T23:59:59+09:00',
    },
    items: [
      {
        code: 'DRUG_ALLERGY',
        value: '알려진 알레르기 없음',
        source: { type: 'USER_ASSERTED' },
        verificationStatus: 'UNVERIFIED',
        observedAt: '2026-08-25T00:00:00Z',
      },
      {
        code: 'ANTICOAGULANT_FLAG',
        value: '아니오',
        source: { type: 'DEMO_ISSUER', displayName: '서울대병원' },
        verificationStatus: 'TEST_VERIFIED',
        observedAt: '2026-08-25T00:00:00Z',
      },
      {
        code: 'EMERGENCY_NOTE',
        value: '1형 당뇨 · 인슐린 펌프 착용 · 저혈당 시 포도당 즉시',
        source: { type: 'DEMO_ISSUER', displayName: '서울대병원' },
        verificationStatus: 'TEST_VERIFIED',
        observedAt: '2026-08-25T00:00:00Z',
      },
    ],
    emergencyContactPresent: true,
  },
};

/** 데모 페르소나 목록 — Landing 화면 안내 카드에서 노출. */
export const DEMO_PERSONA_LABELS: Array<{ code: string; label: string }> = [
  { code: 'M3D1-7K9Q', label: '기본 데모 · 페니실린 알레르기' },
  { code: 'M3D2-A1B2', label: '천식 · NSAIDs 알레르기' },
  { code: 'M3D3-C3D4', label: '페이스메이커 · 항응고제' },
  { code: 'M3D4-E5F6', label: '1형 당뇨 · 인슐린 펌프' },
];

function buildResponse(persona: DemoPersona): EmergencyAccessResponse {
  return {
    accessSessionId: newAccessSessionId(),
    demo: true,
    audience: 'BYSTANDER',
    policyVersion: 3,
    card: persona.card,
    items: persona.items,
    emergencyContactPresent: persona.emergencyContactPresent,
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

  // Error 재현용 토큰 (테스트 시나리오 트리거).
  if (token === 'M3D1-EXPR') throw makeError('EXPIRED');
  if (token === 'M3D1-REVK') throw makeError('REVOKED');
  if (token === 'M3D1-TAMP') throw makeError('TAMPERED');
  if (token === 'M3D1-RATE') throw makeError('RATE_LIMITED');

  // 형식 체크 — 실 backend 400 응답을 mock 에서 흉내.
  if (!/^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(token) && token.length < 16) {
    throw makeError('INVALID');
  }

  // 등록된 페르소나면 그 데이터, 아니면 기본 페르소나로 폴백.
  // 물리 QR/NFC 는 재사용 가능하므로 소진 처리 없음 — 매번 새 accessSessionId 로 응답.
  const persona = PERSONAS[token] ?? PERSONAS['M3D1-7K9Q'];
  return buildResponse(persona);
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
