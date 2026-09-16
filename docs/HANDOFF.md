# 팀별 남은 작업

실측 기준 2026-09-16 · 백엔드 `api-175-45-193-221.sslip.io` · 제출 **2026-09-21 (D-7)**

verifier-web(발견자 웹)은 2026-09-16 자로 "환자 정보 열람" 화면에서 "119 신고 중심" 화면으로
개편했다(EmergencyReport 화면, 위치 조회 · 신고 순서 안내 · 신고 완료 → 가이드 이동).
그 결과 아래 **백엔드 신규 2건**과 **앱팀 확인 1건**이 추가로 필요하다.
기존 "환자·의료진 앱 3건"·"백엔드 2건"은 그대로 유효하다(하단 유지).

## ✅ 위치→주소 변환 — 2026-09-16, verifier-web 이 자체 구현 완료

`POST /api/public/v1/location/reverse-geocode` 를 더 이상 백엔드팀에 요청하지 않는다.
Naver Cloud Platform Maps 크리덴셜(Client ID/Secret)을 전달받아, verifier-web 저장소 안에
**Netlify Function** (`netlify/functions/reverse-geocode.mts`) 으로 직접 구현하고 실제
Naver API 로 검증까지 마쳤다(서울시청·설악산 좌표로 도로명/지번/건물명/산악 여부 확인).

- Client Secret 은 Netlify Function 환경변수(`NAVER_MAPS_CLIENT_ID`/`NAVER_MAPS_CLIENT_SECRET`)
  로만 존재하고 코드·git 에는 없다. **Netlify 사이트의 Environment variables 에 두 값을
  등록해야** 배포본에서 동작한다.
- 클라이언트 지도 SDK(`VITE_NAVER_MAPS_CLIENT_ID`, 위치 카드의 "지도로 보기" 토글)는 Naver
  Cloud Platform 콘솔에 **이 배포 도메인을 "서비스 URL"로 등록**해야 지도 타일이 뜬다 —
  등록 전에는 로컬(`localhost`)에서 401 로 지도만 안 뜨고 주소 텍스트는 정상 동작한다.
- **⚠️ 이 Function 은 Netlify 배포에서만 동작한다.** 지금 실제 서비스 중인 주소
  (`https://api-175-45-193-221.sslip.io/emergency`, `deploy-micro.yml`) 는 SSH 로 정적
  파일만 올리는 NCP micro 라 서버 로직이 없다 — 그 경로로 계속 배포한다면 이 기능은
  거기서는 계속 404 로 폴백(정상 동작하되 도로명 주소 대신 안내 문구)한다. Netlify 로
  전환하거나, 백엔드가 같은 크리덴셜로 자기 서버에 동일 라우트를 추가해야 그 주소에서도 된다.

## 🆕 백엔드팀 — verifier-web 119 개편에 따른 신규 1건

### `POST /api/public/v1/emergency-access/{accessSessionId}/report-complete` (신규 엔드포인트)

발견자가 "신고 완료" 를 누르면 보내는 신호. 서버가 accessSessionId 로 세션을 역추적해
**보호자에게 문자/알림을 발송**한다(발견자에게는 전화번호도, 성공 여부도 노출하지 않음).
Request/Response 는 body 없이 204 면 충분. 이 엔드포인트가 없어도(404) 프론트는 실패를
무시하고 응급처치 가이드로 넘어가므로 데모 진행에는 지장 없다.

**보호자(비상연락) DB 연결은 별도로 요청하지 않는다** — 이미 팀 로드맵에 있는 별도
구현 예정 기능이라 지금 이 문서에서 새로 올리지 않는다. 다만 이 엔드포인트는 보호자
연락처가 실제로 존재해야 의미가 있으므로, 그 기능이 붙기 전까지는 만들어도 우선순위가
낮다는 점만 참고.

또한 `docs/frontend-api-integration.md` §QR fragment 에 이미 기록된 QR 도메인 미해결
이슈(`demo.medivc.invalid` 는 실제 폰 카메라로 스캔 불가)가 이번 개편으로 더 중요해졌다 —
"QR을 찍는다" 가 새 플로우의 첫 단계이므로, 환자 앱이 `qrTicket` 으로
`https://<verifier-web 배포 URL>/#ticket=<qrTicket>` 을 직접 조립해 QR 을 생성하는 경로가
없으면 실제 기기 데모에서 QR 스캔 자체가 안 된다.

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
