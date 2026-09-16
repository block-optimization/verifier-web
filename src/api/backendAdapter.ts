import type {
  BackendEmergencyAccessResponse,
  EmergencyAccessResponse,
  PolicyAudience,
} from '../types';

/*
 * 실 백엔드 응답 → UI 형태 어댑터.
 *
 * 발견자 화면은 더 이상 백엔드의 FHIR `records[]` 를 파싱해 보여주지 않는다
 * (§ 119 신고 중심 피봇). 이 어댑터는 accessSessionId/audience/demo 판정만 흡수한다.
 */

function mapAudience(audience: string): PolicyAudience {
  return audience === 'RESPONDER' ? 'DEMO_CLINICIAN' : 'BYSTANDER';
}

export function adaptBackendResponse(
  raw: BackendEmergencyAccessResponse,
): EmergencyAccessResponse {
  const classification = raw.classification ?? '';
  return {
    accessSessionId: raw.accessSessionId,
    demo: /DEMO|SYNTHETIC/i.test(classification),
    audience: mapAudience(raw.audience),
  };
}
