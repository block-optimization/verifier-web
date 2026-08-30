// Response shape mirrors MEDIVC_MASTER_PLAN §4 "핵심 JSON" and the
// documented POST /api/public/v1/emergency-access boundary. Update this file
// once the live OpenAPI is fetched from the DEV backend.

export type ItemCode =
  | 'DRUG_ALLERGY'
  | 'BLOOD_TYPE'
  | 'MEDICATION_SUMMARY'
  | 'CONDITION'
  | 'IDENTITY'
  | 'EMERGENCY_CONTACT'
  | 'EMERGENCY_NOTE'
  | 'ANTICOAGULANT_FLAG';

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
}

export interface EmergencyCardMeta {
  issuer: string;
  signatureVerified: boolean;
  expiresAt: string;
}

export type PolicyAudience = 'BYSTANDER' | 'DEMO_CLINICIAN';

export interface EmergencyAccessResponse {
  // Opaque, single-session handle. §0/§5 원칙에 따라 안정적 환자 식별자를
  // 노출하지 않으며, 서버가 발급한 이 값만으로 후속 액션(비상연락 중계 등)을
  // 인증한다. 세션 만료 후 서버측에서 무효화된다.
  accessSessionId: string;
  // 합성 데이터 응답 여부. mock 은 항상 true. 실서버는 데모/스테이지 응답에
  // true 를, 실제 환자 데이터 응답에 false 를 채운다. (현재 DEV backend 는 항상 true.)
  demo: boolean;
  audience: PolicyAudience;
  policyVersion: number;
  card: EmergencyCardMeta;
  // Server has already filtered items by the active ConsentPolicy for this
  // audience. Client renders whatever it receives and does not add fields.
  items: EmergencyItem[];
  // Presence flag only — the raw phone number is never sent to BYSTANDER.
  emergencyContactPresent: boolean;
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
