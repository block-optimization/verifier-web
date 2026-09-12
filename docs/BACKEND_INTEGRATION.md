# Backend 연동

verifier-web 이 어떤 Backend 를 어떻게 호출하는지 정리한다.
전사 계약 원본은 `block-optimization/docs` 의 `frontend-api-integration.md` 이지만,
그 문서의 base URL 은 구 EC2 주소라 아래 실측값이 우선한다.

**최종 실측: 2026-09-13**

## 대상 서버

| 환경 | Base URL | 비고 |
| --- | --- | --- |
| DEV | `https://api-175-45-193-221.sslip.io` | **Naver Cloud**. 공인 IP 기반 sslip.io 이므로 IP 변동 시 갱신 필요 |
| STAGE / PROD | 미배포 | |

Swagger UI: `https://api-175-45-193-221.sslip.io/docs`
OpenAPI JSON: `https://api-175-45-193-221.sslip.io/openapi.json`

URL 을 바꿀 때 수정할 곳 4개:
`netlify.toml` (redirect 3건) · `vite.config.ts` (기본값) · `.env.example` · 이 문서

## verifier-web 이 호출하는 endpoint

| 상태 | Method + Path | 인증 | 용도 |
| --- | --- | --- | --- |
| ✅ 배포·검증 완료 | `POST /api/public/v1/emergency-access` | 없음 · 단회 티켓 | 발견자 최소정보 조회 |
| ❌ 백엔드에 없음 | `POST /api/public/v1/emergency-contact/dial` | — | 비상연락 중계. **엔드포인트 미존재** → 화면에서 버튼 숨김 (`emergencyContactPresent: false` 고정) |
| ❌ 백엔드에 없음 | `GET /v1/guides` | — | 응급처치 가이드. mock + 번들 PDF 로 대체 중 |

**FE 가 호출하지 않는 경계** (전사 규칙):
`/internal/*` · `/metrics` · Blockchain worker RPC · registry address · signer key ·
`INTERNAL_SERVICE_TOKEN` · `/api/patient/*` · `/api/responder/*` · `/api/auth/*`

## 요청 body

```jsonc
// POST /api/public/v1/emergency-access
{ "qrTicket":   "1kcuuVWEVlxkMmvh_--uEkMQrDlWvqoY7Q_HedaRPp0" }  // base64url 40~100자
{ "manualCode": "9111590523" }                                     // 숫자 정확히 10자리
```

티켓은 **단회용** (`singleUse: true`). 소비 후 재사용 시 401.

## 응답 — 실측 원본

```jsonc
// HTTP 201
{
  "accessSessionId": "812474ed-0acb-42a8-8429-665157d5ec34",
  "audience": "PUBLIC",
  "classification": "DEMO / SYNTHETIC — NOT FOR CLINICAL USE",
  "records": [
    {
      "resource": {
        "resourceType": "AllergyIntolerance",
        "clinicalStatus": { "coding": [{ "code": "active", "system": "..." }] },
        "criticality": "high",
        "code": { "text": "땅콩 알레르기 (합성)" }
      },
      "isSynthetic": true,
      "sourceType": "SYNTHETIC_FIXTURE",
      "sourceName": "데모 합성 병원",
      "verificationStatus": "DEMO_VERIFIED",
      "issuedAt": "2026-01-01T00:00:00.000Z",
      "lastUpdatedAt": "2026-08-01T00:00:00.000Z",
      "expiresAt": "2099-12-31T23:59:59.999Z",
      "freshnessStatus": "CURRENT"
    }
  ],
  "warnings": ["UNKNOWN FRESHNESS — VERIFY BEFORE RELIANCE"],
  "excludedExpiredCount": 0
}
```

## 어댑터 — `src/api/backendAdapter.ts`

백엔드는 FHIR `records[]`, 화면은 플랫 `items[]` 를 쓴다. 어댑터가 경계를 흡수한다.

### resourceType → ItemCode

| FHIR resourceType | ItemCode |
| --- | --- |
| `AllergyIntolerance` | `DRUG_ALLERGY` |
| `Condition` | `CONDITION` |
| `MedicationStatement` | `MEDICATION_SUMMARY` |
| `Observation` | `BLOOD_TYPE` |
| `Device` | `IMPLANTED_DEVICE` |
| `Flag` | 텍스트로 세분화 → `ADVANCE_DIRECTIVE` / `ANTICOAGULANT_FLAG` / `EMERGENCY_NOTE` |
| 그 외 | `UNKNOWN` (버리지 않는다 — 응급상황에선 "분류 미상이지만 값 있음" 이 안전) |

### 필드 매핑

| 백엔드 | 화면 | 비고 |
| --- | --- | --- |
| `accessSessionId` | `accessSessionId` | 그대로. §0/§5 opaque 원칙 충족 |
| `classification` 에 DEMO/SYNTHETIC 포함 | `demo: true` | 정규식 판정 |
| `audience: PUBLIC` | `BYSTANDER` | `RESPONDER` → `DEMO_CLINICIAN` |
| `resource.code.text` | `items[].value` | 폴백: `coding[0].display` → `valueCodeableConcept.text` → `valueString` |
| `verificationStatus: DEMO_VERIFIED` | `TEST_VERIFIED` | 그 외 전부 `UNVERIFIED` |
| `sourceName` | `items[].source.displayName` | "본인/self/patient" 포함 시 `USER_ASSERTED` |
| `lastUpdatedAt` ?? `issuedAt` | `items[].observedAt` | |
| `freshnessStatus` | `items[].freshness` | `CURRENT` 아니면 화면에 "최신성 미확인" 배지 |
| 검증된 레코드의 최빈 `sourceName` | `card.issuer` | 유도 불가 시 `card` 자체를 생략 |
| — | `card.signatureVerified: true` | 서버가 티켓 검증 후 데이터를 준 사실이 곧 서명 통과 |
| 레코드 중 가장 이른 `expiresAt` | `card.expiresAt` | |
| `warnings[]` | `warnings[]` | 화면에 경고 카드로 노출 |
| `excludedExpiredCount` | 동일 | 0 초과면 "만료 N건 제외" 고지 |
| (없음) | `policyVersion` | 공개 응답에 없음 → 화면에서 행 숨김 |
| (없음) | `emergencyContactPresent: false` | dial endpoint 미존재 → 버튼 숨김 |

## 실패 응답 매핑 — `errorFromStatus`

| status | 백엔드 code | reason | UI |
| --- | --- | --- | --- |
| **401 / 403** | `ACCESS_TICKET_INVALID` | `EXPIRED` | "이 응급 카드가 만료되었어요" + 119 유지 |
| 429 | — | `RATE_LIMITED` | "잠시 후 다시 시도" |
| 410 | — | `REVOKED` | "환자가 이 카드를 철회했어요" |
| 400 / 404 / 422 | `VALIDATION_FAILED` 등 | `INVALID` | "이 카드를 확인할 수 없어요" |
| (network) | — | `NETWORK` | "연결을 확인해 주세요" |

**백엔드는 만료·재사용(소비됨)·존재하지 않음을 전부 401 `ACCESS_TICKET_INVALID` 로 반환한다.**
단일 사유로 좁힐 수 없어, 발견자에게 가장 실행 가능한 안내인 `EXPIRED`
("환자가 갱신한 카드나 팔찌가 근처에 있을 수 있다") 로 매핑했다.
백엔드가 사유를 세분화하면 이 매핑을 갱신한다.

## 수동코드 · QR 티켓 형식 — `src/api/codeFormat.ts`

| 형식 | 정규식 | 출처 |
| --- | --- | --- |
| 실 백엔드 수동코드 | `^[0-9]{10}$` | `POST /cards/{id}/tickets` 의 `manualCode` |
| 데모 코드 | `^[A-Z0-9]{4}-[A-Z0-9]{4}$` | mock 페르소나·실패 시나리오 트리거 |
| QR 티켓 | `^[A-Za-z0-9_-]{40,100}$` | `qrTicket` |

## QR fragment

`App.tsx::initialScreen` 이 `#ticket=` 과 `#t=` **양쪽**을 파싱한다.

- 백엔드 `qrPayload`: `https://demo.medivc.invalid/emergency#ticket=<token>`
- 마스터플랜 §5 표기 · 기존 데모 QR: `https://.../e#t=<token>`

토큰은 첫 렌더 이전에 `history.replaceState` 로 주소창·히스토리에서 제거된다.

### ⚠️ 미해결 — QR 도메인

백엔드가 발급하는 `qrPayload` 의 도메인이 `demo.medivc.invalid` (RFC 2606 예약 TLD) 라
**일반 폰 카메라로 스캔하면 DNS 해석에 실패해 verifier-web 에 도달하지 않는다.**
OpenAPI 스키마에 정규식으로 고정되어 있다:

```
^https://demo\.medivc\.invalid/emergency#ticket=[A-Za-z0-9_-]{40,100}$
```

현재 이 QR 은 **Responder 앱이 in-app 카메라로 스캔해 토큰만 추출하는 경로**에서만 동작한다.
verifier-web 을 QR 대상으로 쓰려면 다음 중 하나가 필요하다:

1. 백엔드가 `qrPayload` 도메인을 배포 URL 로 설정 가능하게 변경
2. 환자 앱이 `qrTicket` 으로 직접 URL 을 조립 (`https://<verifier-web>/#ticket=<qrTicket>`)

그 전까지 verifier-web 진입 경로는 **수동코드 입력** 과 **직접 조립한 `#ticket=` URL** 이다.

## CORS

백엔드는 CORS 를 열지 않는다.

- **DEV**: Vite dev proxy 로 same-origin 위장 (`vite.config.ts`, `.env.local` 의 `VITE_API_PROXY_TARGET`)
- **PROD**: `netlify.toml` 의 `[[redirects]]` 가 Netlify Edge 에서 `/api/*` 를 백엔드로 forward
- 브라우저에서 `https://api-...` 를 직접 fetch 하지 않는다

## 온체인 격리

verifier-web 은 블록체인 client 를 번들하지 않는다 (`ethers`·`viem`·`wagmi` 등 0건).
백엔드 응답은 chain 트랜잭션 완료를 기다리지 않고 반환된다 (§0).
발견자는 응급정보 소비자이며 감사이력·anchor tx 는 환자 앱이 다룬다.

## 로컬 스모크

```bash
cp .env.example .env.local
# VITE_USE_REAL_BACKEND=true
npm run dev

# 다른 터미널 — 실 티켓 발급
B=https://api-175-45-193-221.sslip.io
PT=$(curl -s -X POST $B/demo/v1/tokens/patient | sed 's/.*"token":"//;s/".*//')
CID=$(curl -s -X POST $B/api/patient/v1/cards -H "authorization: Bearer $PT" \
  -H 'content-type: application/json' -d '{"credentialLifetimeSeconds":3600}' \
  | sed 's/.*"cardId":"//;s/".*//')
curl -s -X POST $B/api/patient/v1/cards/$CID/tickets -H "authorization: Bearer $PT" \
  -H 'content-type: application/json' -d '{"purpose":"PUBLIC","ttlSeconds":300}'
```

응답의 `manualCode` 를 Landing 입력창에, 또는 `qrTicket` 을
`http://localhost:5173/#ticket=<qrTicket>` 로 붙여 접속한다.

## TODO

- [ ] QR 도메인 문제 해결 (위 §QR fragment 참조) — **백엔드 또는 앱팀 결정 필요**
- [ ] 백엔드가 만료/철회/변조를 401 하나가 아닌 개별 코드로 구분하면 `errorFromStatus` 세분화
- [ ] `emergency-contact/dial` endpoint 확정 후 비상연락 버튼 활성화
- [ ] `GET /v1/guides` endpoint 확정 후 mock·번들 PDF 제거 검토
- [ ] 백엔드 OpenAPI CI 아티팩트로부터 client type 자동 생성 → 수기 `types.ts` 대체
- [ ] Playwright E2E (마스터플랜 P0-12 "20회 연속 성공")
