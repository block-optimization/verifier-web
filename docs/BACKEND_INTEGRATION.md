# Backend 연동

이 문서는 verifier-web 이 실제로 어떤 Backend 를 어떻게 호출하는지 정리한다.
전사 계약 원본은 `block-optimization/docs` 의 [frontend-api-integration.md](https://github.com/block-optimization/docs/blob/main/frontend-api-integration.md) 이다 — 이 파일은 그 요약이다.

## 대상 서버

| 환경 | Base URL | 비고 |
| --- | --- | --- |
| DEV | `https://34-205-135-30.sslip.io` | EC2 공인 IP 기반 sslip.io. IP 변동 시 `.env.local` 수정 |
| STAGE / PROD | 미배포 | |

Swagger UI : `https://34-205-135-30.sslip.io/docs`
OpenAPI JSON : `https://34-205-135-30.sslip.io/openapi.json`

## verifier-web 이 호출하는 endpoint (사용중 · 예정)

| 상태 | Method + Path | 인증 | 용도 |
| --- | --- | --- | --- |
| ✅ | `POST /api/public/v1/emergency-access` | 없음 · 단회 ticket | 발견자 최소정보 조회 (QR / 수동코드) |
| 🟡 예정 | `POST /api/public/v1/emergency-contact/dial` | 없음 · accessSessionId | 비상연락 서버 중계 (mock 만 있음) |
| 🟡 예정 | `GET /v1/guides` | 없음 | 응급처치 원문 링크 목록 (mock 만 있음) |

**FE 가 절대 호출하지 않는 경계** — 전사 규칙:

- `/internal/*`, `/internal/v1/anchor-jobs/*`
- `/metrics`
- Blockchain worker RPC · registry address · signer key · `INTERNAL_SERVICE_TOKEN`
- Backend patient / responder API (`/api/patient/*`, `/api/responder/*`) —
  이 앱은 발견자용이므로 인증된 흐름이 없다.

## 요청 body

```jsonc
// POST /api/public/v1/emergency-access
{ "qrTicket":   "<base64url · 서버 발급>" }   // QR fragment 로 들어온 경우
{ "manualCode": "M3D1-7K9Q" }                  // 수동코드 입력 경우
```

Ticket 은 **단회용**. 성공 여부와 무관하게 서버가 소비 처리한다 (재사용 시 실패).

## 응답 정합성

현재 client 는 아래 shape 를 기대한다 (`src/types.ts`).

```ts
interface EmergencyAccessResponse {
  accessSessionId: string;       // opaque · 매 조회마다 신규
  demo: boolean;                 // 합성 데이터 여부
  audience: 'BYSTANDER' | 'DEMO_CLINICIAN';
  policyVersion: number;
  card: { issuer: string; signatureVerified: boolean; expiresAt: string };
  items: EmergencyItem[];        // 서버가 이미 정책 필터링
  emergencyContactPresent: boolean;  // 존재 여부만 (전화번호 X)
}
```

### 주의 · 정합성 게이트

1. Backend OpenAPI 를 받아 실제 응답 필드명이 다르면 `src/types.ts` 를 조정한다.
   특히 **안정적 환자 식별자 (profileId 등) 를 응답에 포함하지 않도록 백엔드와 합의** 되어야 한다.
   §0/§5 원칙: `accessSessionId` 같은 opaque · 세션 단회 값만 노출.
2. `items[].code` enum 은 마스터플랜 §4 정의를 따른다. 새 코드가 추가되면
   `ItemCode` union 과 `ITEM_LABEL` map 을 함께 갱신한다.
3. `emergencyContactPresent` 대신 실제 전화번호가 응답에 실려 오면 즉시 백엔드에 반환 요청.

## 실패 응답 매핑

FE 는 HTTP status 로 다음을 도출한다 (`src/api/emergencyAccess.ts::errorFromStatus`).

| status | reason | UI |
| --- | --- | --- |
| 429 | `RATE_LIMITED` | "잠시 후 다시 시도해 주세요" + 119 유지 |
| 410 | `REVOKED` | "환자가 이 카드를 철회했어요" + 119 유지 |
| 400 / 404 | `INVALID` | "이 카드를 확인할 수 없어요" + 119 유지 |
| (network) | `NETWORK` | "연결을 확인해 주세요" + 119 유지 |
| — | `EXPIRED` / `TAMPERED` | Backend 가 별도 코드로 전달 필요 (현재 mock 만 재현) |

`EXPIRED` 와 `TAMPERED` 를 서버에서 어떻게 신호할지 계약 확정 필요.
후보안 : HTTP 200 with `{ error: { reason: 'EXPIRED' } }` payload, 또는
전용 status code. 결정되면 `errorFromStatus` 를 갱신한다.

## CORS

Backend 는 CORS 를 열지 않는다. 따라서:

- **DEV** : Vite dev proxy 를 통해 same-origin (`/api/...`) 으로 위장한다.
  `vite.config.ts` 의 proxy 설정과 `.env.local` 의 `VITE_API_PROXY_TARGET` 참조.
- **PROD** : same-origin reverse proxy 또는 BFF 뒤에 두어야 한다.
  브라우저에서 절대 `https://34-...` 를 직접 fetch 하지 않는다.

## 온체인 격리

verifier-web 은 블록체인 client 를 번들하지 않는다 (`ethers` · `viem` · `wagmi` 등 0건).
Backend 응답은 chain 트랜잭션 완료를 기다리지 않고 반환된다 (§0). 발견자는 응급정보
소비자이며 감사이력 · anchor tx 는 환자 앱 (별도 저장소) 이 다룬다.

## 실서버 스위치 · 로컬 스모크

```bash
cp .env.example .env.local
# VITE_USE_REAL_BACKEND=true
# VITE_API_PROXY_TARGET=https://34-205-135-30.sslip.io
npm run dev

# 다른 터미널에서 Backend 준비 확인
curl -f https://34-205-135-30.sslip.io/health
curl -f https://34-205-135-30.sslip.io/ready
```

브라우저에서 `http://localhost:5173` 을 열고, Backend Swagger 에서 patient token →
card 발급 → ticket 발급 순으로 얻은 `qrTicket` 또는 `manualCode` 를 Landing 에 입력하여
end-to-end 를 확인한다.

## TODO

- [ ] Backend OpenAPI CI 아티팩트에서 client type 을 생성해 `types.ts` 대체
- [ ] `EXPIRED` / `TAMPERED` 신호 방식을 백엔드와 확정
- [ ] `emergency-contact/dial` endpoint 확정 후 mock 제거
- [ ] `/v1/guides` 실 endpoint 확정 후 mock 제거
- [ ] Playwright E2E (P0-12 20회 연속 성공)
