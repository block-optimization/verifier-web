// UI-facing shape. 실 백엔드(POST /api/public/v1/emergency-access)는 FHIR 기반
// `records[]` 를 반환하지만, 발견자 화면은 더 이상 그 내용을 표시하지 않는다.
// (§ verifier-web 119 신고 중심 피봇 — 발견자에게 환자의 질병·약물 정보를 노출하지 않음)
// `accessSessionId` 만 후속 액션(신고 완료 신호 전송)에 쓴다.

export type PolicyAudience = 'BYSTANDER' | 'DEMO_CLINICIAN';

export interface EmergencyAccessResponse {
  // Opaque, single-session handle. §0/§5 원칙에 따라 안정적 환자 식별자를
  // 노출하지 않으며, 서버가 발급한 이 값만으로 후속 액션(신고 완료 신호)을 인증한다.
  accessSessionId: string;
  // 합성 데이터 응답 여부. 실 백엔드는 classification 문자열로 알려주므로
  // 어댑터가 "DEMO"/"SYNTHETIC" 포함 여부로 판정한다.
  demo: boolean;
  audience: PolicyAudience;
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
 * 백엔드는 여전히 FHIR records[] 를 반환하지만, adaptBackendResponse 는
 * accessSessionId/audience/classification 판정에만 쓰고 records[] 는 버린다.
 * ------------------------------------------------------------------------- */

export interface BackendEmergencyAccessResponse {
  accessSessionId: string;
  audience: string;
  classification?: string;
  records?: unknown[];
  warnings?: string[];
  excludedExpiredCount?: number;
}
