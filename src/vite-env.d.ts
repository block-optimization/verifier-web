/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * DEV proxy 가 forward 할 Backend origin. 로컬 개발에서만 유효하며 (server.proxy),
   * production build 는 same-origin 배포 또는 reverse proxy 를 전제로 상대 경로를 쓴다.
   */
  readonly VITE_API_PROXY_TARGET?: string;

  /**
   * Naver Cloud Platform Maps 클라이언트 SDK 로드용 Client ID. 프론트 번들에
   * 포함되어도 안전하다 — NCP 콘솔에 등록한 서비스 URL(도메인)로만 접근이 제한된다.
   * Client Secret 은 여기 두지 않는다 (netlify/functions/reverse-geocode.mts 전용).
   * 값이 없으면 위치 카드의 "지도로 보기" 토글이 비활성으로 표시된다.
   */
  readonly VITE_NAVER_MAPS_CLIENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
