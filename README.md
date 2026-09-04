# MediVC verifier-web

> 응급 카드를 스캔·수동입력한 **발견자(bystander)** 를 위한 모바일 웹.
> QR 이나 8자리 코드를 넣으면 정책이 허용한 **최소 응급정보**만 보여주고, 어느 화면에서든
> **119 전화**·**비상연락 서버 중계**·**공식 응급처치 원문**에 엄지 한 번으로 닿는다.

이 저장소는 데모용이다. 실제 환자·신원·의료정보를 입력하지 않는다. 자세한 경계는
[SECURITY.md](SECURITY.md) 참조.

---

## 1. 왜 이 앱이 존재하는가

**상황.** 낯선 사람이 길에서 쓰러진 환자를 발견한다. 환자는 응급 카드나 팔찌를 지니고
있지만, 발견자는 그 사람이 아니고 어떤 앱도 설치하지 않았다.

**목표.** 발견자가

1. **앱 설치 없이** 자신의 폰 브라우저로
2. **5초 안에** 필수 응급정보(알레르기·항응고제·응급메모)를 보고
3. **첫 행동으로 119**를 걸 수 있어야 한다.

동시에

- 환자의 **주소·주민번호·전체 병력·처방은 절대 노출되지 않는다.**
- QR 링크가 사진에 찍히거나 브라우저 히스토리에 남아도 정보가 새지 않는다.
- 카드가 **만료·철회·위조**된 경우 발견자에게 그 사실을 알리되, 그 정보가 공격에
  악용되지 않아야 한다.
- 발견자는 **환자의 블록체인 감사이력에 접근하지 않는다.** 발견자는 소비자이지 감사자가
  아니다.

이 요구가 정확히 어떤 코드로 반영됐는지는 §3에서 마스터플랜 조항과 대응시켜 정리한다.

---

## 2. 스코프

| 포함 | 배제 |
|---|---|
| QR fragment (`#t=<token>`) 자동 진입 | 환자 앱 (온보딩·프로필·공개정책·QR 카드 발급) |
| 8자리 수동코드 진입 | 응급대원(DEMO clinician) 차등공개 UI (P1) |
| 서명 · 만료 · 철회 · 변조 · rate-limit 상태별 UI | 감사이력 조회 (환자 앱 소관) |
| 정책 필터링된 최소 응급정보 렌더 (BYSTANDER audience) | 온체인 참조 · anchor tx · commitment (Backend/Worker) |
| 119 sticky dock (모든 화면) | ZKP proof 생성 (환자 앱) |
| 비상연락 서버 중계 (전화번호 미노출) | 실제 모바일 신분증 · OpenDID 발급 |
| 공식 응급처치 원문 링크 (질병관리청 · 행정안전부) | MyHealthWay 연동 |

**한 문장 요약:** 이 저장소는 마스터플랜 §6 IA "검증자 모바일 웹" 축을 **P0 100%** 완결한
독립 프론트다.

---

## 3. 마스터플랜 → 구현 매핑

각 마스터플랜 조항이 어느 파일·함수·CSS 규칙에 어떻게 반영됐는지 추적 가능하도록 정리했다.
스크린을 새로 추가하거나 결정을 뒤집을 때 이 표를 먼저 읽는다.

### §0 성공 기준

| 마스터플랜 요구 | 구현 근거 |
|---|---|
| "다른 기기의 모바일 브라우저에서 앱 설치 없이 5초 안에 최소정보가 표시된다" | React SPA + Vite prod 번들 **gzip 55 KB** — 3G에서도 초기 로드 후 API 왕복이 병목. 검증 화면(`screens/Verifying.tsx`)은 "최대 5초" 힌트 표기 |
| "변조·만료·철회된 VC/QR은 의료정보를 반환하지 않는다" | `screens/ErrorScreen.tsx` REASON_COPY 6종. 어떤 실패도 절대 `EmergencyInfo` 로 진입시키지 않고 정보를 렌더하지 않는다 |
| "QR·URL·로그·Chain에 의료정보 원문과 안정적 환자 식별자가 없다" | `App.tsx:46-51` fragment 토큰을 첫 렌더 전에 `history.replaceState` 로 제거. `types.ts` 응답 스키마에 profileId 등 안정 식별자 없이 opaque `accessSessionId` 만 노출 |
| "Chain 장애 시에도 응급정보는 보이고 Audit가 비동기 재시도된다" | 이 저장소에는 **블록체인 dependency 0건** (`ethers/viem/wagmi` 검색 결과 없음). Backend 응답을 그대로 렌더하며 chain 상태를 대기하지 않는다 |

### §1 P0/P1/P2 — verifier 축

| P0 백로그 | 상태 |
|---|---|
| P0-07 QR · 수동코드 (FE 지분) | ✅ `screens/Landing.tsx` |
| P0-08 검증자 모바일 웹 · Safari/Chrome 동작 | ✅ 전 화면 iOS/Android 대응 |
| P0-09 119 · 비상연락 · 가이드 (119 최상위 CTA) | ✅ `components/Call119Button.tsx` + sticky-actions dock |
| P0-06 Demo VC 검증 결과 표시 (FE 지분) | ✅ `screens/EmergencyInfo.tsx` + `components/VerificationBadge.tsx` |

### §5 데이터 모델·보안 수용 기준

| 원칙 | 어디에 구현 |
|---|---|
| "QR URL은 `https://demo.medivc.kr/e#t=<256-bit-random>` — fragment 는 서버 로그에 자동 전송되지 않는다" | `App.tsx::readTokenFromHash` — fragment 를 body 로 옮긴 뒤 `history.replaceState(null, '', pathname)` 로 URL·히스토리에서 제거 |
| "정적 QR 은 일반 발견자 최소정보만 허용" | mock 응답의 BYSTANDER audience 3필드 고정 (`DRUG_ALLERGY`, `ANTICOAGULANT_FLAG`, `EMERGENCY_NOTE`). 실서버는 정책 필터를 서버측에서 강제 |
| "Access session 은 짧게 · nonce · idempotency · Rate Limit · generic error" | 실 서버 계약 준수. FE 는 실패 사유가 일부 노출되더라도(§ 아래) `EmergencyInfo` 로는 절대 진입시키지 않는 이중 방어 |
| "안정적 환자 식별자 없음" | `types.ts::EmergencyAccessResponse` 에 `profileId` 등 없이 opaque `accessSessionId` 만. `callEmergencyContact(accessSessionId)` 도 세션 핸들만 사용 |
| "로그 마스킹" | 소스에 `console.log/info/debug/warn/error` **0건** · 3rd party 텔레메트리 **0건** · `localStorage/sessionStorage/cookie` **0건** |

**의도적 이탈 하나:** 원칙상 "generic error" 인데, `ErrorScreen` 은 만료·철회·위조를 서로
다른 문구로 표시한다. 이유는 코드 상단 주석에 명시했다 — QR 토큰이 256-bit random +
rate-limit + 단회사용이라 oracle 공격 실익이 극히 낮은 반면, 발견자가 "만료" vs "위조" 를
구분하면 다른 카드를 찾을지·정보를 신뢰할지 판단이 달라진다.

### §7 저충실도 와이어프레임 (발견자 관련)

| 와이어프레임 | 대응 파일 | 핵심 지침 반영 |
|---|---|---|
| V1 랜딩 (수동코드) | `screens/Landing.tsx` | "카메라 없이 진입" — 8자리 수동코드 폼 + 데모 힌트 |
| V2 검증 중 | `screens/Verifying.tsx` | 3단 체크리스트 (카드 활성·만료 / VC 테스트 서명 / 데이터 출처) + 최대 5초 힌트 |
| V4 만료·철회·오류 | `screens/ErrorScreen.tsx` | "검증 실패 시 의료정보를 표시하지 않되 119 버튼은 유지" |
| V8 발견자 최소정보 | `screens/EmergencyInfo.tsx` | triage + 119 + PHI 3필드 + 비상연락 + 가이드 + 출처상세 |
| V9 DEMO 의료진 | — | ⛔ 의도 제외 (P1 · 환자 앱 소관) |

### §10 데이터 소스 · 라이선스

가이드는 앱이 임의로 생성한 응급처치 지시가 아니라 **공식 원문 페이지 딥링크**만 제공한다.
현재 큐레이션 목록 (`api/guides.ts`):

| 항목 | 원문 URL | 출처 · 라이선스 |
|---|---|---|
| 심폐소생술 (CPR) | health.kdca.go.kr/... /gnrlzHealthInfoView.do | 질병관리청 국가건강정보포털 · 공공누리 제1유형 |
| 기도 폐쇄 · 하임리히 | health.kdca.go.kr/... ?cntnts_sn=6227 | 동상 |
| 응급처치 일반 행동요령 | safekorea.go.kr/... action-guide.do?category=firstAid | 행정안전부 국민재난안전포털 · 공공누리 제1유형 |

`Guide.tsx` 상단 카피에 "앱은 응급처치 지시를 임의로 생성하지 않습니다" 명시.

---

## 4. 아키텍처

```
                       ┌────────────────────────────────────────┐
                       │  발견자 폰의 브라우저 (iOS Safari / Chrome) │
                       └──┬─────────────────────────────────────┘
                          │  ①  https://.../e#t=<opaque 256-bit token>
                          │     └── App.tsx: fragment 읽고 URL에서 즉시 제거
                          ▼
              ┌─────────────────────────────┐
              │  verifier-web (this repo)   │
              │                             │
              │  screens/Landing            │◄── 수동코드 대체 경로
              │  screens/Verifying          │
              │  screens/EmergencyInfo      │
              │  screens/ErrorScreen        │
              │  screens/Guide              │
              │                             │
              │  api/emergencyAccess.ts     │
              │    · mock (오프라인 · CI)    │
              │    · real (VITE_USE_REAL_   │
              │      BACKEND=true 시)       │
              └────┬─────────────────┬──────┘
                   │                 │
       Vite proxy  │ /api/*          │ /demo/*  /.well-known/*
       (dev)       │                 │
       ▼           ▼                 ▼
      ┌───────────────────────────────────┐
      │  Backend  (block-optimization/    │
      │           backend, 별개 저장소)     │
      │                                   │
      │  POST /api/public/v1/             │      ┌──────────────┐
      │       emergency-access            │──►   │  audit outbox │
      │  (⛔ 현재 DEV 미배포)               │      └────┬─────────┘
      └───────────────────────────────────┘           │
                                                       │ 비동기
                                                       ▼
                                         ┌──────────────────────────┐
                                         │  Blockchain worker + Chain │
                                         │  (block-optimization/      │
                                         │   blockchain, 별개 저장소)  │
                                         │                            │
                                         │  · Merkle root anchor 만    │
                                         │  · FE 는 절대 호출 안 함     │
                                         └──────────────────────────┘
```

**결정 로그**

1. **왜 SPA 인가.** RN Bare 로도 갈 수 있지만 발견자는 앱 설치를 하지 않는다.
   순수 웹이라야 카메라 → 브라우저 → 정보 이 흐름이 원-샷으로 끝난다.
2. **왜 의존성이 `react` + `react-dom` 뿐인가.** 상태 라이브러리·라우터·데이터 fetcher를
   전부 뺐다. 화면 5개 · 유일한 fetch 하나뿐이라 오버 엔지니어링을 피하고 gzip 55 KB 를
   지켰다.
3. **왜 backend URL 을 env 로 뺐는가.** DEV EC2 가 IP 기반 sslip.io 라서 IP 변동 시 하드코드는 곧 링크 부패. `.env.local` 의 `VITE_API_PROXY_TARGET` 로 격리.
4. **왜 blockchain 라이브러리를 안 쓰는가.** 발견자는 감사자가 아니다.
   `frontend-api-integration.md` §7 "FE 응답은 chain 성공을 기다리지 않는다" 명문. 코드에서도
   `ethers/viem/wagmi/walletconnect` **0건**.

---

## 5. 디자인 시스템 — Liquid Glass

### 왜 이 미학인가

응급 스트레스 상황에서 화면이 시각적 자극을 더하면 안 된다. 그러나 딱딱한 UI 는 앱 자체의
신뢰를 떨어뜨린다. 이 둘 사이의 답으로 **Apple iOS 26 Liquid Glass** 계열의 반투명 유리
표면을 택했다.

- 유리 아래로 **오로라 mesh** 가 은은히 흐른다 → 앱이 살아있다는 감각
- 그러나 표면은 저채도 · 저대비 → 정보가 우선
- **119 만** 강렬한 코랄 유리 + heat glow → 유일한 강한 시각 signaling
- **다크모드 자동 전환** → 야간 응급 상황에 눈부심 없음
- `prefers-reduced-motion`·`prefers-contrast: more`·landscape 모두 대응

### 구성 요소

- **타이포**: Pretendard Variable (한국어 웹 최적) · Instrument Serif Italic (헤드라인 강조) ·
  JetBrains Mono (수동코드)
- **유리 표면**: `backdrop-filter: blur(22px) saturate(180%)` + specular top edge
  (`::after` 그라디언트)
- **119 버튼**: 3-stop 코랄 그라디언트 + specular sheen + heat glow drop-shadow
- **모션**: 아이템 stagger fade-up · 검증 체크리스트 순차 등장 · triage 붉은 점 pulse

세부는 `src/styles.css` 참조. CSS 만으로 500 라인 이내에서 표현했다.

---

## 6. 보안 불변식

이 앱이 살아있는 동안 **절대 어겨서는 안 되는** 7가지. `SECURITY.md` 와 대응.

1. QR 토큰은 URL fragment (`#t=<token>`) 로만 들어오고, **첫 렌더 이전에** 주소창·히스토리에서
   제거된다. → `App.tsx:46-51`
2. 응답 body 어디에도 **안정적 환자 식별자가 없다.** 세션 스코프 opaque `accessSessionId`
   하나만. → `types.ts:44`
3. **의료정보는 실패 화면에 절대 나타나지 않는다.** 어떤 오류든 `ErrorScreen` 은 카피와
   119 버튼만 렌더. → `App.tsx::screen` 상태 머신 · `ErrorScreen.tsx`
4. **119 는 어느 화면에서도 엄지 한 번에 닿는다.** `sticky-actions` dock 이 모든 화면에 고정.
   → `styles.css::.sticky-actions`
5. **비상연락 전화번호는 브라우저로 오지 않는다.** 서버가 dial 을 중계하고 클라이언트는
   `emergencyContactPresent: boolean` 존재 여부만 받는다. → `emergencyAccess.ts::callEmergencyContact`
6. **블록체인 client 를 번들하지 않는다.** 발견자는 감사자가 아니다. → `package.json`
   dependency `react`, `react-dom` 두 개뿐
7. **3rd party 텔레메트리·analytics·error reporter 를 default 로 포함하지 않는다.** 추가
   시엔 반드시 ticket·session ID·PHI redaction 필터가 선행한다. → `CONTRIBUTING.md::Boundaries`

---

## 7. 화면 상세

### V1 · Landing (`screens/Landing.tsx`)
QR 카메라로 진입 못한 경우의 대체 경로. 8자리 수동코드 (`M3D1-7K9Q` 포맷) 입력 폼.
Details 패널에 5개 데모 코드 노출.

### V2 · Verifying (`screens/Verifying.tsx`)
"서명 확인 중" — 카드 활성·VC 서명·데이터 출처 3단 순차 등장. 최대 5초 힌트.

### V8 · EmergencyInfo (`screens/EmergencyInfo.tsx`)
발견자가 보는 유일한 정보 화면.
- 상단 `signature-ok` pill 로 서명 검증 상태
- Triage 카드: "먼저 의식·호흡 확인 → 즉시 119"
- PHI 카드 3장: 약물 알레르기 · 항응고제 복용 · 응급 메모 (server 정책이 필터링)
- 각 카드에 `TEST_VERIFIED` / `UNVERIFIED` 뱃지 → 사용자 입력을 기관 검증값처럼 보이지 않게
- Sticky 하단 dock: [119 전화] + [비상연락 호출] (전화번호 미노출)
- 접힘 가능한 provenance : 발급자 · 서명 · 만료 · 정책 버전 · audience
- Footnote : "이 열람은 감사 로그에 기록되며 환자 본인에게 통보됩니다"

### V4 · ErrorScreen (`screens/ErrorScreen.tsx`)
6개 실패 사유별 카피 · 아이콘. §5 원칙("generic error") 에서 의도적으로 이탈한 부분은 파일
상단 주석에 근거 명시.

### Guide (`screens/Guide.tsx`)
공식 원문 페이지 딥링크 3개. 앱이 응급처치 지시를 임의 생성하지 않음을 명시. §10 준수.

---

## 8. 개발

### 필요

- Node 20 LTS 이상

### Mock 만으로 즉시 데모

```bash
npm ci
npm run dev            # http://localhost:5173
```

`.env.local` 없이 전 화면 동작. Landing 의 "데모 코드 안내" 패널이 아래 5개 상태를 재현한다.

| 코드 | 결과 |
|---|---|
| `M3D1-7K9Q` | 정상 카드 (BYSTANDER 최소 3필드) |
| `M3D1-EXPR` | 만료 |
| `M3D1-REVK` | 철회 |
| `M3D1-TAMP` | 변조 감지 |
| `M3D1-RATE` | Rate limit |

같은 코드 두 번 = 단회용 규칙으로 실패.

### 실서버 연동

```bash
cp .env.example .env.local
# .env.local 수정:
# VITE_USE_REAL_BACKEND=true
# VITE_API_PROXY_TARGET=https://api-175-45-193-221.sslip.io
npm run dev
```

CORS 미개방이라 Vite proxy 필수. 자세한 계약·엔드포인트·정합성 게이트는
[docs/BACKEND_INTEGRATION.md](docs/BACKEND_INTEGRATION.md).

**현재 상태 (2026-08-30):** 공개 소비자 엔드포인트 `POST /api/public/v1/emergency-access` 가
DEV 백엔드에 아직 배포되지 않았다. 배포 전까지는 mock 만으로 데모한다.

### 스크립트

| 명령 | 설명 |
|---|---|
| `npm run dev` | Vite dev server (port 5173) |
| `npm run build` | TypeScript strict + Vite production build → `dist/` |
| `npm run preview` | 빌드 결과 로컬 프리뷰 |

### CI

`.github/workflows/ci.yml` — main / dev 푸시 · PR 시 typecheck + prod build + 아티팩트
14일 보존.

---

## 9. 프로젝트 구조

```
verifier-web/
├─ index.html                 # aurora background 컨테이너 · font preconnect · viewport lock
├─ vite.config.ts             # env-driven proxy target (VITE_API_PROXY_TARGET)
├─ tsconfig.json              # strict + noUnusedLocals + noUnusedParameters
├─ .env.example               # 로컬 환경변수 템플릿
├─ .github/workflows/ci.yml   # tsc + vite build
├─ src/
│  ├─ main.tsx                # StrictMode 진입점
│  ├─ App.tsx                 # 화면 상태 머신 · fragment 토큰 처리
│  ├─ styles.css              # Liquid Glass 디자인 시스템 (~500 LoC)
│  ├─ vite-env.d.ts           # ImportMetaEnv 타입 확장
│  ├─ types.ts                # EmergencyAccessResponse 등 API 계약
│  ├─ api/
│  │  ├─ emergencyAccess.ts   # 실서버 스위치 + mock 응답
│  │  └─ guides.ts            # 공식 원문 링크 (kdca · safekorea)
│  ├─ components/
│  │  ├─ Call119Button.tsx    # 코랄 유리 CTA
│  │  ├─ DemoBanner.tsx       # 상단 DEMO 표시
│  │  └─ VerificationBadge.tsx  # TEST_VERIFIED / UNVERIFIED 뱃지
│  └─ screens/
│     ├─ Landing.tsx          # QR/수동코드 진입 · 데모 힌트
│     ├─ Verifying.tsx        # 서명 확인 중 · 3단 체크리스트
│     ├─ EmergencyInfo.tsx    # 발견자 최소정보 · 비상연락 · provenance
│     ├─ ErrorScreen.tsx      # 6가지 실패 사유별 카피
│     └─ Guide.tsx            # 공식 원문 페이지 목록
└─ docs/
   └─ BACKEND_INTEGRATION.md
```

**크기:** 소스 15개 파일 · **2,024 LoC** (styles.css 포함) · 문서 · 설정 556 LoC ·
prod 번들 **gzip 55 KB**.

---

## 10. 관련 저장소

| 저장소 | 역할 |
|---|---|
| [`block-optimization/backend`](https://github.com/block-optimization/backend) | API · demo issuer · ZKP · audit outbox |
| [`block-optimization/blockchain`](https://github.com/block-optimization/blockchain) | Audit anchor contract + worker |
| [`block-optimization/frontend`](https://github.com/block-optimization/frontend) | 환자 앱 (별개 모노레포, 이 저장소와 무관) |
| [`block-optimization/docs`](https://github.com/block-optimization/docs) | 프로젝트 문서 · 멘토링 기록 · CLAUDE.md 원본 |

---

## 11. 로드맵 (미구현 · 대기)

- [ ] 백엔드 `POST /api/public/v1/emergency-access` DEV 배포 후 실서버 스위치 스모크
- [ ] 백엔드 OpenAPI CI 아티팩트로부터 client type 자동 생성 → `types.ts` 대체
- [ ] `EXPIRED` · `TAMPERED` HTTP 시그널 방식 백엔드와 확정 후 `errorFromStatus` 매핑 갱신
- [ ] `emergency-contact/dial` · `/v1/guides` 실 endpoint 배포 후 mock 제거
- [ ] Playwright E2E — 마스터플랜 P0-12 "20회 연속 성공" 시나리오 자동화
- [ ] Lighthouse mobile · axe-core accessibility 회귀 파이프라인
- [ ] Same-origin BFF · reverse proxy 배포 청사진 (프로덕션)

---

## 라이선스

Apache-2.0 — [LICENSE](LICENSE)
