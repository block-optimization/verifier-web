/*
 * 수동코드 형식 판정.
 *
 * 두 형식이 공존한다:
 *  · 실 백엔드 — 숫자 10자리 (예: 6491754268). `POST /cards/{id}/tickets` 의 manualCode.
 *  · 데모/mock — 8자 하이픈 코드 (예: M3D1-7K9Q). 페르소나·실패 시나리오 트리거용.
 *
 * QR 티켓은 40~100자 base64url 이라 길이로 구분된다.
 */

/** 실 백엔드가 발급하는 수동코드: 숫자 10자리. */
export const BACKEND_MANUAL_CODE = /^[0-9]{10}$/;

/** 데모 코드: 영숫자 4 + 하이픈 + 영숫자 4. */
export const DEMO_MANUAL_CODE = /^[A-Z0-9]{4}-[A-Z0-9]{4}$/;

/** 서버가 발급한 QR 티켓 (base64url, 40자 이상). */
export const QR_TICKET = /^[A-Za-z0-9_-]{40,100}$/;

export function isAcceptableCode(value: string): boolean {
  return (
    BACKEND_MANUAL_CODE.test(value) ||
    DEMO_MANUAL_CODE.test(value) ||
    QR_TICKET.test(value)
  );
}

/**
 * 입력창 정규화. 숫자만 10자리면 그대로 두고, 8자 영숫자는 하이픈을 넣어준다.
 * 백엔드 코드에 하이픈을 끼워넣지 않도록 숫자 경로를 먼저 판정한다.
 */
export function normalizeCode(raw: string): string {
  const t = raw.trim().toUpperCase();
  if (/^[0-9]{10}$/.test(t)) return t;
  if (t.includes('-')) return t;
  if (/^[A-Z0-9]{8}$/.test(t)) return `${t.slice(0, 4)}-${t.slice(4)}`;
  return t;
}
