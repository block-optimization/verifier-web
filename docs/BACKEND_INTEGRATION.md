# Backend 연동

verifier-web 이 백엔드를 어떻게 호출하는지 정리한다.
기준: **FE 웹 수정요청서 2026-09-20** · OpenAPI `https://api-175-45-193-221.sslip.io/openapi.json`

2026-09-16 자로 공개 환자조회가 폐지되면서 이 웹의 백엔드 의존은 **역지오코딩 1건**으로
줄었다. 폐지 이전의 티켓·수동코드·최소정보 조회 계약은
[HANDOFF.md 「현재 사양」](HANDOFF.md#현재-사양) 과 [BACKEND_QUESTIONS.md](BACKEND_QUESTIONS.md) 에
이력으로만 남긴다.

## 대상 서버

| 환경 | Base URL | 비고 |
| --- | --- | --- |
| DEV | `https://api-175-45-193-221.sslip.io` | **Naver Cloud**. 공인 IP 기반 sslip.io 이므로 IP 변동 시 갱신 필요 |
| STAGE / PROD | 미배포 | |

Swagger UI: `https://api-175-45-193-221.sslip.io/docs/`

URL 을 바꿀 때 수정할 곳 3개: `netlify.toml`(redirect 1건) · `vite.config.ts`(기본값) · `.env.example`.

## 호출하는 endpoint — 1건

```http
POST /api/public/v1/location/reverse-geocode
Content-Type: application/json

{ "lat": 37.5665, "lng": 126.978 }
```

201 응답 (2026-09-20 실측, 서울시청 좌표):

```json
{
  "roadAddress": "서울특별시 중구 세종대로 110",
  "jibunAddress": "서울특별시 중구 태평로1가 31",
  "buildingName": "서울특별시청",
  "isMountainous": false
}
```

| 필드 | 화면에서의 쓰임 |
| --- | --- |
| `roadAddress` | 1순위 표시. 119에 그대로 불러주는 값 |
| `jibunAddress` | 도로명이 없는 지역(신규·농어촌)의 폴백. "(지번)" 을 덧붙여 표시 |
| `buildingName` | 있으면 주소보다 위에 크게. "건물 안이라면 층·호실도" 안내로 전환 |
| `isMountainous` | true 면 국가지점번호·등산로 위치표지판 안내로 전환 |

셋 다 없으면 좌표를 소수점 5자리로 읽어준다.

**호출 규칙**

- 좌표만 보낸다. 환자·QR 정보를 함께 보내지 않는다. 조회기록·체인 이벤트를 만들지 않는다.
- **화면 진입 1회** 또는 사용자의 명시적 "위치 다시 확인" 에만 호출한다
  (`EmergencyReport.tsx` 의 `autoLoaded` ref 가 StrictMode 이중 마운트까지 막는다).
  지도 토글에서 지도를 탭하는 것도 사용자의 명시적 행위로 본다.
- 현재 백엔드는 **한글 주소만** 제공한다. 영문 주소를 제공한다고 표시하지 않는다.
- 네이버 Maps Client Secret 은 백엔드에만 둔다. 프론트 번들·환경변수·이 저장소에 두지 않는다.
  (2026-09-20 이전에는 Netlify Function 이 직접 NCP 를 호출해 배포 측에도 비밀키 사본이
  필요했다. 백엔드가 같은 계약을 제공하면서 그 함수를 제거했다.)

## 호출하지 않는 endpoint

폐지된 공개 환자조회 — 호출이 **0회**여야 하고 E2E(`tests/e2e/invariants.spec.ts`)가 이를 강제한다.

| Method + Path | 상태 |
| --- | --- |
| `POST /api/public/v1/card-sessions` | 410 `PUBLIC_DISCLOSURE_RETIRED` |
| `POST /api/public/v1/emergency-access` | 410 `PUBLIC_DISCLOSURE_RETIRED` |
| `POST .../emergency-access/{id}/report-complete` | 폐지 |

`PUBLIC_DISCLOSURE_RETIRED` 는 **기능 폐지**다. 개별 카드의 철회가 아니므로
"환자가 카드를 철회했습니다" 로 표시하면 안 된다. 애초에 호출하지 않는 것이 맞다.

**FE 가 넘지 않는 경계** (전사 규칙):
`/internal/*` · `/metrics` · Blockchain worker RPC · registry address · signer key ·
`INTERNAL_SERVICE_TOKEN` · `/api/patient/*` · `/api/responder/*` · `/api/auth/*`

## CORS · 프록시

백엔드는 CORS 를 열지 않는다. 브라우저에서 `https://api-...` 를 직접 fetch 하지 않고
same-origin 상대경로만 쓴다.

- **DEV**: Vite dev proxy (`vite.config.ts`, `.env.local` 의 `VITE_API_PROXY_TARGET`)
- **PROD(Netlify)**: `netlify.toml` 의 `[[redirects]]`
- 두 곳 모두 **역지오코딩 경로 하나만** forward 한다. `/api/*` 를 통째로 열면 이 배포
  도메인이 백엔드 전체 API 의 공개 게이트웨이가 된다.

## 온체인 격리

verifier-web 은 블록체인 client 를 번들하지 않는다 (`ethers`·`viem`·`wagmi` 등 0건).
발견자의 공개 웹 이용은 의료정보 조회기록이나 체인 이벤트를 만들지 않는다.

## 로컬 스모크

```bash
cp .env.example .env.local
npm run dev            # http://localhost:5173 — 위치 권한 허용 후 주소 표시 확인

# 백엔드 단독 확인
curl -s -X POST https://api-175-45-193-221.sslip.io/api/public/v1/location/reverse-geocode \
  -H 'content-type: application/json' -d '{"lat":37.5665,"lng":126.978}'
```

## TODO

- [ ] 백엔드 OpenAPI 아티팩트로부터 응답 타입 자동 생성 → 수기 `ReverseGeocodeResult` 대체
- [ ] `GET /v1/guides` 확정 후 번들 가이드 상수·PDF 제거 검토
- [ ] STAGE/PROD base URL 확정 시 위 3곳 갱신
