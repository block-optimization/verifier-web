/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * "true" 이면 프론트가 실서버(Backend `/api/public/v1/emergency-access`) 를 호출한다.
   * "false" 이거나 미설정이면 mock (src/api/emergencyAccess.ts) 로 폴백한다.
   * Vite 는 client bundle 에 노출하기 위해 `VITE_` 접두를 요구한다.
   */
  readonly VITE_USE_REAL_BACKEND?: 'true' | 'false';

  /**
   * DEV proxy 가 forward 할 Backend origin. 로컬 개발에서만 유효하며 (server.proxy),
   * production build 는 same-origin 배포 또는 reverse proxy 를 전제로 상대 경로를 쓴다.
   */
  readonly VITE_API_PROXY_TARGET?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
