import type {
  BackendEmergencyAccessResponse,
  BackendRecord,
  EmergencyAccessResponse,
  EmergencyCardMeta,
  EmergencyItem,
  ItemCode,
  PolicyAudience,
  SourceType,
  VerificationStatus,
} from '../types';

/*
 * 실 백엔드 응답 → UI 형태 어댑터.
 *
 * 백엔드(POST /api/public/v1/emergency-access)는 FHIR 리소스를 담은 `records[]`
 * 를 반환하고, 화면은 플랫한 `items[]` 를 기대한다. 이 파일이 그 경계를 흡수한다.
 *
 * 원칙
 *  · 값을 만들어내지 않는다. 백엔드에 없는 필드는 undefined 로 남겨 화면이 행을 숨긴다.
 *  · freshnessStatus · warnings · excludedExpiredCount 는 버리지 않고 화면까지 전달한다
 *    (발견자가 오래된 정보를 과신하지 않도록).
 *  · 알 수 없는 resourceType 은 버리지 않고 UNKNOWN 으로 표시한다 — 응급 상황에서
 *    "표시되지 않음" 보다 "분류 미상이지만 값은 있음" 이 안전하다.
 */

/** FHIR resourceType → 화면 항목 코드. 백엔드 consent-policy 의 데이터 클래스와 대응. */
const RESOURCE_TO_CODE: Record<string, ItemCode> = {
  AllergyIntolerance: 'DRUG_ALLERGY',
  Condition: 'CONDITION',
  MedicationStatement: 'MEDICATION_SUMMARY',
  Observation: 'BLOOD_TYPE',
  Device: 'IMPLANTED_DEVICE',
  Flag: 'EMERGENCY_NOTE',
};

/**
 * Flag 리소스는 응급 메모와 사전연명의료의향서 양쪽에 쓰인다.
 * 텍스트로 구분해 사전의향서를 별도 코드로 승격한다.
 */
function refineFlagCode(text: string): ItemCode {
  if (/사전연명|연명의료|사전의향|advance directive/i.test(text)) {
    return 'ADVANCE_DIRECTIVE';
  }
  if (/항응고|와파린|anticoagul|warfarin/i.test(text)) {
    return 'ANTICOAGULANT_FLAG';
  }
  return 'EMERGENCY_NOTE';
}

/** 표시 가능한 값 문자열을 뽑는다. 없으면 null → 해당 레코드는 건너뛴다. */
function extractValue(record: BackendRecord): string | null {
  const r = record.resource;
  const candidates = [
    r.code?.text,
    r.code?.coding?.[0]?.display,
    r.valueCodeableConcept?.text,
    r.valueString,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim().length > 0) return c.trim();
  }
  return null;
}

function mapVerification(status?: string): VerificationStatus {
  return status === 'DEMO_VERIFIED' || status === 'VERIFIED'
    ? 'TEST_VERIFIED'
    : 'UNVERIFIED';
}

/**
 * 출처 종류. 백엔드 sourceType 은 SYNTHETIC_FIXTURE 처럼 데이터 유래를 말하고,
 * 화면은 "기관 발급" vs "본인 입력" 을 구분해야 한다. 검증 상태와 출처명으로 판정한다.
 */
function mapSourceType(record: BackendRecord): SourceType {
  const name = record.sourceName ?? '';
  if (/본인|self|patient|user/i.test(name)) return 'USER_ASSERTED';
  return mapVerification(record.verificationStatus) === 'TEST_VERIFIED'
    ? 'DEMO_ISSUER'
    : 'USER_ASSERTED';
}

function mapFreshness(status?: string): EmergencyItem['freshness'] {
  if (status === 'CURRENT') return 'CURRENT';
  if (status === 'STALE') return 'STALE';
  if (status === 'UNKNOWN') return 'UNKNOWN';
  return undefined;
}

function toItem(record: BackendRecord): EmergencyItem | null {
  const value = extractValue(record);
  if (!value) return null;

  const resourceType = record.resource?.resourceType ?? '';
  let code = RESOURCE_TO_CODE[resourceType] ?? 'UNKNOWN';
  if (code === 'EMERGENCY_NOTE') code = refineFlagCode(value);

  return {
    code,
    value,
    source: {
      type: mapSourceType(record),
      displayName: record.sourceName,
    },
    verificationStatus: mapVerification(record.verificationStatus),
    observedAt: record.lastUpdatedAt ?? record.issuedAt ?? '',
    freshness: mapFreshness(record.freshnessStatus),
  };
}

function mapAudience(audience: string): PolicyAudience {
  return audience === 'RESPONDER' ? 'DEMO_CLINICIAN' : 'BYSTANDER';
}

/**
 * 카드 메타 유도. 공개 응답에는 발급자·서명·만료가 없다.
 *  · issuer  — 검증된 레코드의 최빈 sourceName
 *  · signatureVerified — 서버가 티켓을 검증하고 데이터를 반환했다는 사실 자체가
 *    서명 검증 통과를 의미한다 (클라이언트가 따로 검증할 수단이 없음)
 *  · expiresAt — 레코드 중 가장 이른 만료. 전부 없으면 카드 메타를 생략한다.
 */
function deriveCard(records: BackendRecord[]): EmergencyCardMeta | undefined {
  const verified = records.filter(
    (r) => mapVerification(r.verificationStatus) === 'TEST_VERIFIED' && r.sourceName,
  );
  const counts = new Map<string, number>();
  for (const r of verified) {
    const n = r.sourceName as string;
    counts.set(n, (counts.get(n) ?? 0) + 1);
  }
  let issuer: string | undefined;
  let best = 0;
  for (const [name, n] of counts) {
    if (n > best) {
      best = n;
      issuer = name;
    }
  }
  if (!issuer) return undefined;

  const expiries = records
    .map((r) => r.expiresAt)
    .filter((e): e is string => typeof e === 'string' && e.length > 0)
    .sort();

  return {
    issuer,
    signatureVerified: true,
    expiresAt: expiries[0] ?? '',
  };
}

export function adaptBackendResponse(
  raw: BackendEmergencyAccessResponse,
): EmergencyAccessResponse {
  const records = Array.isArray(raw.records) ? raw.records : [];
  const items = records
    .map(toItem)
    .filter((i): i is EmergencyItem => i !== null);

  const classification = raw.classification ?? '';
  const card = deriveCard(records);

  return {
    accessSessionId: raw.accessSessionId,
    demo: /DEMO|SYNTHETIC/i.test(classification),
    audience: mapAudience(raw.audience),
    // 공개 응답에 정책 버전·카드 메타가 없으면 생략 — 화면이 해당 행을 숨긴다.
    ...(card ? { card } : {}),
    items,
    // 공개 열람에서 비상연락 중계 endpoint 가 아직 없으므로 버튼을 띄우지 않는다.
    emergencyContactPresent: false,
    ...(raw.warnings?.length ? { warnings: raw.warnings } : {}),
    ...(raw.excludedExpiredCount ? { excludedExpiredCount: raw.excludedExpiredCount } : {}),
    ...(classification ? { classification } : {}),
  };
}
