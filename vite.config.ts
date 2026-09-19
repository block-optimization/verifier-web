import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

/*
 * Same-origin proxy for the DEV backend.
 *
 * DEV backend base URL 은 EC2 공인 IP 기반 sslip.io 라 IP 변동 시 바뀔 수 있다.
 * 하드코딩 대신 `.env.local` 의 VITE_API_PROXY_TARGET 로 주입한다.
 *
 * Backend CORS 미개방이 전제이므로 브라우저에서 직접 호출 금지. 반드시 이 proxy
 * 를 거쳐 same-origin 으로 위장한 뒤 상대 경로만 사용한다.
 *
 * verifier-web 이 실제로 호출하는 유일한 백엔드 경로는
 * `/api/public/v1/location/reverse-geocode` 뿐이다 (src/api/location.ts).
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target = env.VITE_API_PROXY_TARGET ?? 'https://api-175-45-193-221.sslip.io';
  const proxyOptions = { target, changeOrigin: true, secure: false } as const;

  return {
    plugins: [react()],
    server: {
      port: 5173,
      host: true,
      // 최소 권한 — 실제로 호출하는 경로 하나만 forward 한다.
      // netlify.toml 의 프로덕션 redirect 와 범위를 일치시켜 dev/prod 동작이 갈리지 않게 한다.
      // 폐지된 공개 환자조회 경로는 dev 에서도 열지 않는다(FE 수정요청서 2026-09-20).
      proxy: {
        '/api/public/v1/location/reverse-geocode': proxyOptions,
      },
    },
  };
});
