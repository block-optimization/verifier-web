# 팀별 남은 작업

실측 기준 2026-09-14 · 백엔드 `api-175-45-193-221.sslip.io` · 제출 **2026-09-21 (D-7)**

verifier-web(발견자 웹)은 기능적으로 완료되어 이 문서에 할 일이 없다.
남은 것은 **환자·의료진 앱 3건**과 **백엔드 2건**이다.

---

## 앱팀 — 3건

백엔드가 전부 배포·검증 완료된 엔드포인트다. **앱 코드의 주석이 낡아
"백엔드에 API가 없다"고 말하고 있으나 사실이 아니다.**

### 🔴 1. 공개범위 정책 연결 — 가장 시급

"환자가 무엇을 공개할지 정한다"가 제품의 핵심 서사인데 지금 토글이 서버로 가지 않는다.
화면에 `MOCK` 배지가 붙어 있어 심사에서 바로 드러난다.

낡은 주석: `apps/patient/src/state/demo.ts:12` — `consent → 공개정책 API (미구현)`

실측으로 확인한 동작:
```
PUT /api/patient/v1/consent-policy → 200, version 1 → 2
그 직후 발견자 조회 → 응급메모가 사라지고 알레르기만 남음
```
정책 변경이 발견자 화면에 **즉시 반영**된다.

```jsonc
GET /api/patient/v1/consent-policy
→ 200  { "version": 1, "audiences": { "PUBLIC": [...], "RESPONDER": [...] } }
   ETag: "1"

PUT /api/patient/v1/consent-policy
   If-Match: "1"          ← 필수. 없으면 428 Precondition Required
{ "audiences": {
    "PUBLIC":    ["ALLERGY", "EMERGENCY_NOTE"],
    "RESPONDER": ["ALLERGY","CONDITION","BLOOD_TYPE","EMERGENCY_NOTE",
                  "MEDICATION","ANTICOAGULANT","ADVANCE_DIRECTIVE","IMPLANTED_DEVICE"] } }
→ 200  { "version": 2, "audiences": {...} }
```

**주의**: 서버가 `PUBLIC` 에 `ALLERGY`·`EMERGENCY_NOTE` 만 허용한다. 혈액형을 넣으면 400.
프론트가 임의로 공개 범위를 넓히지 못하게 서버가 막는 구조이므로 UI 도 그 둘만 토글로 노출해야 한다.

### 🟡 2. 비상연락인 연결

낡은 주석: `apps/patient/src/app/guardians.tsx:11` — `백엔드에 대응 API가 없어 앱 내부 상태로만 동작한다 (Mock)`

```jsonc
GET  /api/patient/v1/guardians
POST /api/patient/v1/guardians
{ "displayName": "보호자 김OO",
  "relationship": "배우자",
  "maskedPhone": "010-****-1234" }   // ^(?:0[0-9]{1,2})-[*•xX]{3,4}-[0-9]{4}$
→ 201 { "guardianId": "...", ... }

DELETE /api/patient/v1/guardians/{guardianId}
```

### 🟡 3. 본인 입력 항목 저장

낡은 주석: `apps/patient/src/app/(tabs)/profile.tsx:345` — `서버 저장 API가 없어 이 기기에만 남고`

```jsonc
POST /api/patient/v1/self-entered-records
{ "dataClass": "EMERGENCY_NOTE",     // ALLERGY | CONDITION | EMERGENCY_NOTE | MEDICATION
                                     // | BLOOD_TYPE | ANTICOAGULANT | ADVANCE_DIRECTIVE | IMPLANTED_DEVICE
  "displayText": "오른팔 의료밴드 착용" }   // 1~200자
→ 201 { "recordId": "...", "resource": { "resourceType": "Flag", ... },
        "sourceType": "PATIENT_SELF_ENTRY" }

DELETE /api/patient/v1/self-entered-records/{recordId}
```

### 정리 후 해야 할 것

세 개를 붙이면 `LevelBadge level="MOCK"` 3개를 `LIVE` 로 바꾸고,
`apps/patient/src/state/demo.ts` 헤더의 "미구현" 목록에서 consent·guardians 를 지운다.

---

## 백엔드팀 — 2건 (우선순위 낮음)

verifier-web 이 우회 중이라 시연에는 지장이 없다.

### 1. `POST /api/public/v1/emergency-contact/dial` — 404

발견자가 비상연락인에게 전화를 거는 서버 중계 경로. 전화번호를 발견자에게
노출하지 않고 서버가 연결하는 설계였다.

현재 verifier-web 은 `emergencyContactPresent: false` 로 고정해 **버튼을 숨긴다.**
엔드포인트가 생기면 어댑터에서 그 플래그를 살리고 버튼을 되살린다.

### 2. `GET /v1/guides` — 404

응급처치 가이드 목록. 현재 verifier-web 은 소방청 119 생활응급처치 매뉴얼을
요약한 자체 콘텐츠와 번들 PDF 3개로 대체하고 있다.

만들지 않기로 해도 무방하다. 그 경우 현재 우회를 유지한다.

---

## 이미 해결된 것 (참고)

| 항목 | 커밋 |
|---|---|
| qrPayload 도메인 하드코딩 → 환경변수 | backend `03d7e4b` |
| 합성 환자 3명 (ALPHA/BETA/GAMMA) | backend `d6a0861` |
| 재사용 팔찌 + card-sessions 교환 | backend `98b16f3` |
| 환자 홈 QR purpose RESPONDER → PUBLIC | frontend `af521f7` |
| 환자 앱 팔찌 발급·파기 | frontend `3e53d70` |
| 의료진 인증 + 팔찌 QR 판별 | frontend `5c87895` |
| verifier-web 팔찌 지원 | verifier-web `4a8c752` 외 |
| verifier-web E2E 44개 | verifier-web `f46534f` |

---

## 구조상 로컬로 남는 것 (설명만 준비)

심사에서 물어보면 "PoC 범위 밖"이라고 답하면 된다. 마스터플랜이 처음부터
합성 데이터 전제이고 `.well-known` 이 `mobileIdCertified: false` 로 정직하게 선언한다.

- 신규 환자 가입 없음 — 합성 3명 고정. 실 신분증 인증도 ALPHA 로 매핑
  (`backend: src/auth/login.service.ts:102,116`)
- 환자 접근이력의 Chain anchor 상태 — 20초 경과로 추정, 조회 API 없음
- 의료진 조회기록 · 이송 후보 지도 · 소속 등록 — 기기 로컬
- 실 발급기관(MyHealthWay·병원 EMR) 없음 — fixture
