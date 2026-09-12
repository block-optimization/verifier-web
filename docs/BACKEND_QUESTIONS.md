# 백엔드 팀 확인 요청

verifier-web 실 백엔드 연동 과정에서 실측으로 확인한 항목들.
측정 기준: `https://api-175-45-193-221.sslip.io` · 2026-09-13 · `origin/dev@5493186`

우선순위는 **2026-09-21 제출** 기준으로 매겼습니다.

---

## P0 — 시연을 막을 수 있는 것 / 결정 완료 사항

### 1. qrPayload 도메인 변경이 커밋돼 있나요? ⚠️ 유실 위험

배포 서버는 이렇게 반환합니다:
```
"qrPayload": "https://api-175-45-193-221.sslip.io/emergency#ticket=<token>"
```

그런데 **5개 브랜치 전부** 하드코딩입니다:
```ts
// src/access-session/access-session.service.ts:50
qrPayload: `https://demo.medivc.invalid/emergency#ticket=${qrTicket}`
```
확인한 브랜치: `dev` · `main` · `feature/mvp-core` · `feature/mobile-id-transport` · `fix/dev-deploy-routing`
`EMERGENCY_BASE_URL` · `WEB_ORIGIN` 류 환경변수 검색 결과 **0건**.

`src/openapi/openapi.schemas.ts:1090` 의 정규식도 같은 상태입니다:
```
^https://demo\.medivc\.invalid/emergency#ticket=[A-Za-z0-9_-]{40,100}$
```
(다만 배포본 OpenAPI 에서는 이 패턴이 검색되지 않아 스키마도 함께 바뀐 것으로 보입니다)

**묻고 싶은 것**
1. 이 변경이 어느 커밋에 있나요? 커밋 안 됐다면 **재배포 시 `demo.medivc.invalid` 로 되돌아가고**, 그러면 폰 카메라로 QR 을 찍어도 DNS 해석에 실패합니다 — 시연 직전에 터질 수 있습니다.
2. 환경변수로 빼주실 수 있나요? verifier-web 을 Netlify 로 분리 배포할 경우 그쪽 URL 을 가리켜야 합니다.

### 2. 다회용 티켓이 필요합니다 (제품 결정 완료)

**결정 사항**: 물리 매체(팔찌 · 스티커 · NFC 키링)는 **다회용**으로 갑니다.

현재 서버가 이를 막고 있어 프론트에서 우회할 수 없습니다:
```
ttlSeconds must not be greater than 300   ← 상한 강제
singleUse: true                            ← 응답에 고정
```

QR 과 수동코드가 **같은 티켓의 두 표현**임도 확인했습니다 (수동코드로 조회 후 같은 티켓의 QR → 401). 그래서 둘 중 무엇을 인쇄해도 5분 뒤 · 1회 스캔 뒤 죽습니다.

**구현 방식 — 두 가지 선택지**

제품 요구는 "팔찌 QR 이 영구히 동작한다" 하나인데, 구현은 두 갈래입니다.
프론트는 어느 쪽이든 맞출 수 있으니 백엔드가 편한 쪽으로 정해 주세요.

### A안 — 다회용 티켓

기존 티켓에 `singleUse: false` + 긴 TTL 을 허용합니다.

```
POST /cards/{id}/tickets  { purpose, singleUse: false, ttlSeconds: 7776000 }
→ qrPayload 를 팔찌에 새김. 90일간 무제한 스캔
```

- 장점: 기존 구조 그대로, 변경 최소
- 단점: "티켓=일회성 입장권" 의미가 흐려짐. 티켓 테이블에 장수명 레코드가 섞임

### B안 — QR 에 카드 참조를 담고, 스캔 시 서버가 세션 발급 ★ 권장

```
현재:  팔찌 QR → [5분 티켓]      → 만료됨
B안:   팔찌 QR → [영구 카드 참조] → 서버가 스캔 순간 세션 발급 → 항상 동작
```

```
팔찌 QR: https://<host>/emergency#card=<cardRef>
         ↓ verifier-web 이 cardRef 로 조회
POST /api/public/v1/emergency-access  { cardRef: "<...>" }
         ↓ 서버가 그 자리에서 정책 필터링 + accessSessionId 발급 + 감사 기록
```

- 장점: 티켓 단회성 원칙 유지 · 스캔마다 독립 인증·기록 · 파기는 카드 단위로 즉시
- 단점: 공개 엔드포인트가 `cardRef` 도 받아야 함 (입력 종류 3개: qrTicket · manualCode · cardRef)
- `cardRef` 는 cardId(UUID) 를 그대로 쓰면 열거 위험이 있으니 **별도 고엔트로피 값**이 필요합니다

**요청 — 어느 안이든 확정이 필요한 6가지**

| # | 항목 | 논점 |
|---|---|---|
| 1 | **A안 vs B안** | 위 두 방식 중 어느 쪽으로 가시겠습니까? B안을 권장하지만 작업량은 비슷할 것으로 봅니다 |
| 2 | **TTL 정책** | 카드 수명(`credentialLifetimeSeconds`)에 묶을까요, 별도 상한(예: 90일)을 둘까요? 무기한은 피하는 게 좋아 보입니다 |
| 3 | **스캔당 감사 로그** | 다회용이면 접근 이력이 계속 쌓입니다. 중복 억제(같은 티켓 N분 내 재스캔은 1건으로)가 필요할까요? 환자 이력 화면이 도배될 수 있습니다 |
| 4 | **티켓별 rate limit** | 현재 rate limit 은 공개 엔드포인트 단위로 보입니다(무효코드 5회 후 429). QR 사진이 유출됐을 때 남용을 억제하려면 **티켓 단위** 제한이 필요할 수 있습니다 |
| 5 | **파기 즉시성** | 단회용 티켓은 파기 시 **미사용분까지 즉시 무효화**되는 것을 실측 확인했습니다. 다회용도 동일하게 보장되나요? 이게 물리 매체의 **유일한 회수 수단**입니다 |
| 6 | **정책 필터 유지** | PUBLIC audience 가 계속 2건(ALLERGY · EMERGENCY_NOTE)만 노출하나요? 이게 유출 시 피해를 제한하는 주된 장치입니다 |

**보안 트레이드오프 — 인지하고 수용합니다**

다회용은 QR 사진을 찍은 사람이 반복 열람할 수 있음을 뜻합니다. 대신:
- PUBLIC 은 전체 8건 중 **2건만** 노출 (실측 확인)
- 파기가 즉시 차단 (실측 확인 — 다회용도 보장 필요, 위 #5)
- 노출되는 정보가 알레르기 · 응급메모라 **응급 상황에서 공개되는 것이 애초 목적**

기존 의료 팔찌(MedicAlert 등)도 같은 트레이드오프를 받아들이고 있고, 그쪽은 각인이라 회수조차 안 됩니다. 우리는 파기가 되므로 더 낫습니다.

**백엔드 팀이 반대할 이유가 있다면 듣고 싶습니다.** 저희가 놓친 위험이 있을 수 있습니다.

## P1 — 완성도

### 3. 합성 환자가 1명뿐입니다

```ts
// src/synthetic-medical-data/synthetic-fixtures.ts:3
export const DEMO_SUBJECT_ID = '10000000-0000-4000-8000-000000000001';
```

그리고 실제 모바일 신분증 로그인도 여기로 갑니다:
```ts
// src/auth/login.service.ts:102, 116
? await this.persistence.getIdentity(DEMO_SUBJECT_ID)
patientSubjectId: audience === 'PATIENT' ? DEMO_SUBJECT_ID : null,
```

카드를 여러 장 만들면 **cardId 와 링크는 전부 다른데** 의료정보는 전부 같은 환자입니다.

**묻고 싶은 것**
- `synthetic-fixtures.ts` 에 SUBJECT BETA / GAMMA 를 추가할 여력이 있나요? (각각 다른 알레르기 · 질환)
- 추가한다면 `POST /demo/v1/tokens/patient` 가 주체를 고를 수 있어야 합니다. 단 지금 주체 하드코딩은 **의도된 보안 장치**로 보여서(주입 시도 전부 무시됨), demoMode 에서만 허용하는 조건부여야 할 것 같습니다.
- D-8 이라 무리라면 환자 1명으로 가고 "동일 구조로 N명 확장" 으로 설명하겠습니다.

### 4. 만료 · 철회 · 변조가 전부 401 하나로 옵니다

```
소비된 티켓 재사용   → 401 ACCESS_TICKET_INVALID "invalid, expired, or consumed access token"
존재한 적 없는 티켓  → 401 ACCESS_TICKET_INVALID "invalid, expired, or consumed access token"
파기된 카드의 티켓   → 401 ACCESS_TICKET_INVALID (동일)
```

**열거 oracle 이 없는 건 잘 설계된 것**이라 봅니다. 다만 verifier-web 은 발견자에게 사유별로 다른 안내를 하려 했습니다 (만료 → "갱신한 카드가 근처에 있을 수 있다", 철회 → "환자가 공개를 중단했다"). 지금은 전부 `EXPIRED` 로 매핑했습니다.

**묻고 싶은 것**
- 보안상 통합 문구를 유지하실 건가요? 그러면 프론트도 현재 매핑을 유지합니다.
- 아니면 철회(환자의 능동적 행위)만 별도 코드로 구분해 주실 수 있나요? 그건 oracle 위험이 낮다고 판단됩니다.

### 5. 파기된 카드로 티켓 발급 시 500 이 납니다

```
POST /api/patient/v1/cards/{revokedCardId}/tickets → HTTP 500
```
동작(거부)은 맞지만 4xx + 명시적 code 가 적절해 보입니다. 앱이 사용자에게 "이미 파기된 카드입니다" 를 안내할 수 없습니다.

---

## P2 — 프론트가 대기 중인 것

### 6. 없는 endpoint 2개

| 경로 | verifier-web 상태 |
|---|---|
| `POST /api/public/v1/emergency-contact/dial` | 미존재 → 비상연락 버튼을 화면에서 숨김 (`emergencyContactPresent: false` 고정) |
| `GET /v1/guides` | 미존재 → mock + 번들 PDF 로 대체 |

계획에 있나요? 없으면 현재 우회를 유지하겠습니다.

---

## 확인만 필요

### 7. 데모 환자 이력 초기화 방법

`/demo/v1/tokens/*` 에 rate limit 이 없어서(15연타 전부 201) 누구나 카드·티켓을 무제한 발급할 수 있습니다. 주체가 하드코딩이라 **타인 정보 접근은 불가**하고 합성 데이터뿐이라 피해는 없지만, **접근 이력이 시연에 쓰는 그 환자에게 쌓입니다.**

마스터플랜 §4 에 `POST /v1/internal/demo/reset` 이 P0 로 잡혀 있는데 구현돼 있나요? 시연 전 이력 정리가 필요합니다.

### 8. Netlify 분리 배포 시 CORS

현재 `/emergency` 가 verifier-web 을 서빙해서 same-origin 이라 문제가 없습니다. Netlify 를 병행한다면:
- CORS allowlist 에 Netlify origin 을 넣어주실 건가요?
- 아니면 Netlify Edge redirect 로 프록시하는 현재 방식을 유지할까요? (verifier-web `netlify.toml` 에 `/api/public/*` 만 forward 하도록 좁혀 뒀습니다)

### 9. 모바일 신분증 임시 비활성화 상태

`e39a642 fix: AWS 데모 모바일 신분증 임시 비활성화` 커밋이 있습니다. 시연 시점에 되살릴 계획인가요? 환자 앱은 OmniOne CX WebView + PKCE 를 이미 구현해 둔 상태입니다.

---

## 참고 — 이미 잘 돼 있어서 확인만 한 것

측정하면서 확인한 것들입니다. 문제 없습니다.

- **데모 토큰 주체·권한 하드코딩** — `sub` · `patientId` · `scope` 주입 시도 전부 무시. 권한 상승 불가
- **production fail-closed** — `NODE_ENV=production` + `MEDIVC_DEMO_MODE=true` 조합에서 **부팅 실패** (`environment.ts:102`). 런타임 체크보다 강함
- **데모 발급 가드** — `assertDemoIssuanceEnabled()` 가 demoMode 아니면 404 (`auth.service.ts:180`)
- **정책 필터가 서버측 강제** — 전체 8건 중 PUBLIC 은 2건, RESPONDER 는 7건. 나머지는 응답에 아예 없음
- **파기가 미사용 티켓까지 무효화** — 분실 시나리오에서 회수가 실제로 됨
- **Rate limit** — 공개 엔드포인트 무효코드 5회 후 429
- **QR 티켓 엔트로피** — 43자 base64url ≈ 258비트
- **`.well-known` 정직한 선언** — `openDidCertified: false`, `mobileIdCertified: false`, `w3cVerifiableCredentialsCertified: false`
