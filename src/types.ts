// UI-facing shape. 실 백엔드(POST /api/public/v1/emergency-access)는 FHIR 기반
// `records[]` 를 반환하므로 `src/api/backendAdapter.ts` 가 이 형태로 변환한다.
// 백엔드 wire 타입은 이 파일 하단의 Backend* 인터페이스 참조.

export type ItemCode =
  | 'DRUG_ALLERGY'
  | 'BLOOD_TYPE'
  | 'MEDICATION_SUMMARY'
  | 'CONDITION'
  | 'IDENTITY'
  | 'EMERGENCY_CONTACT'
  | 'EMERGENCY_NOTE'
  | 'ANTICOAGULANT_FLAG'
  | 'ADVANCE_DIRECTIVE'
  | 'IMPLANTED_DEVICE'
  | 'UNKNOWN';

export type SourceType = 'DEMO_ISSUER' | 'USER_ASSERTED';

export type VerificationStatus = 'TEST_VERIFIED' | 'UNVERIFIED';

export interface ItemSource {
  type: SourceType;
  displayName?: string;
}

export interface EmergencyItem {
  code: ItemCode;
  value: string;
  source: ItemSource;
  verificationStatus: VerificationStatus;
  observedAt: string;
  /**
   * 백엔드 freshnessStatus 를 그대로 보존한다. CURRENT 외의 값이면 화면에서
   * "최신성 미확인" 을 함께 표시해 발견자가 값을 과신하지 않게 한다.
   */
  freshness?: 'CURRENT' | 'STALE' | 'UNKNOWN';
}

export interface EmergencyCardMeta {
  issuer: string;
  signatureVerified: boolean;
  expiresAt: string;
}

export type PolicyAudience = 'BYSTANDER' | 'DEMO_CLINICIAN';

export interface EmergencyAccessResponse {
  // Opaque, single-session handle. §0/§5 원칙에 따라 안정적 환자 식별자를
  // 노출하지 않으며, 서버가 발급한 이 값만으로 후속 액션을 인증한다.
  accessSessionId: string;
  // 합성 데이터 응답 여부. 실 백엔드는 classification 문자열로 알려주므로
  // 어댑터가 "DEMO"/"SYNTHETIC" 포함 여부로 판정한다.
  demo: boolean;
  audience: PolicyAudience;
  // 실 백엔드 공개 응답에는 정책 버전이 없다. 없으면 화면에서 행을 숨긴다.
  policyVersion?: number;
  // 실 백엔드 공개 응답에는 카드 메타가 없다. 어댑터가 레코드 출처로 유도하며,
  // 유도할 수 없으면 생략하고 화면에서 행을 숨긴다.
  card?: EmergencyCardMeta;
  // 서버가 이미 ConsentPolicy 로 필터링한 결과. 클라이언트는 항목을 추가하지 않는다.
  items: EmergencyItem[];
  // 존재 여부만. 실제 전화번호는 발견자에게 전달되지 않는다.
  emergencyContactPresent: boolean;
  // 백엔드가 붙이는 경고 (예: "UNKNOWN FRESHNESS — VERIFY BEFORE RELIANCE").
  warnings?: string[];
  // 만료로 제외된 레코드 수. 0 보다 크면 화면에 고지한다.
  excludedExpiredCount?: number;
  // 백엔드 classification 원문. 화면 하단 고지에 그대로 노출한다.
  classification?: string;
}

export type AccessErrorReason =
  | 'INVALID'
  | 'EXPIRED'
  | 'REVOKED'
  | 'TAMPERED'
  | 'RATE_LIMITED'
  | 'NETWORK';

export interface AccessError {
  reason: AccessErrorReason;
  message: string;
}

export function isAccessError(e: unknown): e is AccessError {
  return (
    typeof e === 'object' &&
    e !== null &&
    'reason' in e &&
    typeof (e as { reason: unknown }).reason === 'string'
  );
}

/* -------------------------------------------------------------------------
 * Backend wire format — POST /api/public/v1/emergency-access
 * 실측 기준 (2026-09-13, api-175-45-193-221.sslip.io)
 * ------------------------------------------------------------------------- */

export interface BackendFhirResource {
  resourceType: string;
  code?: { text?: string; coding?: Array<{ code?: string; display?: string }> };
  criticality?: string;
  status?: string;
  clinicalStatus?: unknown;
  valueString?: string;
  valueCodeableConcept?: { text?: string };
}

export interface BackendRecord {
  recordId?: string;
  resource: BackendFhirResource;
  isSynthetic?: boolean;
  sourceType?: string;
  sourceName?: string;
  verificationStatus?: string;
  issuedAt?: string;
  lastUpdatedAt?: string;
  expiresAt?: string | null;
  freshnessStatus?: string;
}

export interface BackendEmergencyAccessResponse {
  accessSessionId: string;
  audience: string;
  classification?: string;
  records?: BackendRecord[];
  warnings?: string[];
  excludedExpiredCount?: number;
}
