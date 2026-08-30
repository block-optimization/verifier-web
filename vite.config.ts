import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

/*
 * Same-origin proxy for the DEV backend.
 *
 * DEV backend base URL 은 EC2 공인 IP 기반 sslip.io 라 IP 변동 시 바뀔 수 있다.
 * 하드코딩 대신 `.env.local` 의 VITE_API_PROXY_TARGET 로 주입한다.
 *
 * Backend CORS 미개방이 전제이므로 브라우저에서 직접 호출 금지. 반드시 이 proxy
 * 를 거쳐 same-origin 으로 위장한 뒤 `/api/*`, `/demo/*`, `/.well-known/*`
 * 상대 경로만 사용한다.
 *
 * 실서버 스위치는 별개의 env 인 VITE_USE_REAL_BACKEND 로 제어한다
 * (src/api/emergencyAccess.ts).
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target = env.VITE_API_PROXY_TARGET ?? 'https://34-205-135-30.sslip.io';
  const proxyOptions = { target, changeOrigin: true, secure: false } as const;

  return {
    plugins: [react()],
    server: {
      port: 5173,
      host: true,
      proxy: {
        '/api': proxyOptions,
        '/demo': proxyOptions,
        '/.well-known': proxyOptions,
      },
    },
  };
});
