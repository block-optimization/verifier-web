# MediVC verifier-web

> 쓰러진 사람의 MediVC 팔찌 QR을 **일반 휴대폰 카메라**로 찍은 발견자에게 열리는 모바일 웹.
> 환자를 구분하지 않고 누구에게나 같은 **119 신고 안내**를 보여준다.

기준 사양: [`MediVC_FE_웹_수정요청서_2026-09-20`](docs/HANDOFF.md#현재-사양). 2026-09-16 백엔드가
공개 환자조회 API를 폐지하면서, 이 웹은 "환자 정보를 보여주는 화면"에서 "119 신고를 돕는
화면"으로 완전히 바뀌었다.

---

## 1. 이 웹이 하는 일 / 하지 않는 일

**한다.**

1. QR을 찍은 사람에게 즉시 **응급상황인가요? → 119 전화 → 스피커폰 안내 → 현재 위치 → 신고 스크립트** 순서를 보여준다.
2. 브라우저 위치 권한으로 좌표를 얻어 백엔드 역지오코딩으로 **한글 도로명 주소**를 표시한다. 119에 그대로 불러주면 된다.
3. 신고 후 **공식 응급처치 가이드**(소방청 119 생활응급처치 매뉴얼 요약 + 원문 PDF)로 넘어간다.

**하지 않는다.**

- 환자 이름·의료정보·보호자 연락처·카드 유효성을 **조회하지도 표시하지도 않는다.**
- QR의 `card` 참조값을 **읽지 않는다.** 서버·분석 도구·오류 수집기·로그 어디에도 보내지 않는다.
- "카드 인증 완료"·"환자 확인 완료" 같은, 확인하지 않은 것을 확인했다고 주장하는 문구를 쓰지 않는다.
- 공개 웹 이용 사실을 **의료정보 조회기록이나 체인 이벤트로 남기지 않는다.**

## 2. QR 구조

```text
https://api-175-45-193-221.sslip.io/emergency#card=<opaque-reference>
```

팔찌 QR과 환자 앱 QR은 이제 **같은 반영구 QR 하나**다. origin·path는 모든 환자가 같고,
`card`만 팔찌마다 다르다. 그 참조값으로 환자를 구분하는 건 **인증된 의료진 앱**의 일이고,
이 웹의 일이 아니다.

그래서 이 웹은 fragment를 파싱하지 않는다. `#card=`·레거시 `#ticket=`·`#t=`·fragment 없음이
모두 같은 화면으로 들어온다. 읽지 않은 채 `history.replaceState`로 주소창에서 지우기만 한다
(`src/App.tsx`) — 스크린샷·공유·히스토리·URL 수집형 분석 도구로 참조값이 새지 않게 하려는 것이다.
페이지를 열어 둔 채 다시 스캔하는 경우를 위해 `hashchange`도 같이 듣는다.

**폐지된 공개 환자조회 API는 호출하지 않는다** — `POST /api/public/v1/card-sessions`,
`POST /api/public/v1/emergency-access`, 과거 `report-complete`. 이들은 410
`PUBLIC_DISCLOSURE_RETIRED`를 주는데, 이건 **기능 폐지**이지 "환자가 카드를 철회함"이 아니다.
화면에 철회로 표시하면 안 된다.

## 3. 백엔드 의존

호출하는 엔드포인트는 **하나뿐**이다.

```http
POST /api/public/v1/location/reverse-geocode
{ "lat": 37.5665, "lng": 126.978 }
→ 201 { roadAddress, jibunAddress, buildingName, isMountainous }
```

- 좌표만 보낸다. 환자·QR 정보는 함께 보내지 않는다. 조회기록·체인 이벤트를 만들지 않는다.
- **화면 진입 1회** 또는 사용자가 "위치 다시 확인"을 누를 때만 호출한다. GPS 연속 이벤트마다 호출하지 않는다.
- 네이버 Maps **Client Secret은 백엔드에만** 있다. 프론트 번들·환경변수·이 저장소 어디에도 두지 않는다.
- 도로명 → 지번 → 좌표 순으로 대체하고, 권한 거절·시간 초과·503에서는 소방 기관 공식
  "주소를 모를 때" 안내(큰 건물 상호·전봇대 번호·국가지점번호 등)로 대체한다.
  **위치가 실패해도 119 안내는 절대 막히지 않는다.**

`VITE_NAVER_MAPS_CLIENT_ID`가 설정돼 있으면 위치 카드에 "지도로 보기" 토글이 생긴다(지도 탭 →
그 지점 주소). Client ID는 비밀값이 아니라 NCP 콘솔의 서비스 URL 허용목록으로 보호된다.
값이 없으면 토글 자체가 렌더되지 않는다.

## 4. 구조

```
verifier-web/
├─ index.html                  # viewport(확대 허용) · 폰트 preconnect
├─ vite.config.ts              # dev proxy — 역지오코딩 경로 하나만 forward
├─ netlify.toml / public/_headers   # 배포 헤더 · redirect (두 파일 값은 반드시 일치)
├─ src/
│  ├─ main.tsx                 # StrictMode 진입점
│  ├─ App.tsx                  # fragment blind 제거 + report ↔ guide 전환
│  ├─ styles.css               # 디자인 시스템
│  ├─ api/
│  │  ├─ location.ts           # Geolocation + 역지오코딩 + Naver Maps 지연 로드
│  │  └─ guides.ts             # 응급처치 가이드 콘텐츠(요약) · 원문 PDF 경로
│  ├─ components/Call119Button.tsx
│  └─ screens/
│     ├─ EmergencyReport.tsx   # 발견자 공통 화면 (신고 순서 · 위치)
│     └─ Guide.tsx             # 응급처치 가이드 목록 · 상세
└─ tests/e2e/                  # Playwright — 아래 불변식을 강제한다
```

## 5. 지켜야 할 불변식 (E2E가 강제)

`tests/e2e/` 는 수정요청서의 「완료 확인」 체크리스트를 그대로 테스트로 옮긴 것이다.

| 불변식 | 테스트 |
|---|---|
| 서로 다른 환자 QR이 **글자 하나까지 같은** 화면을 낸다 | `entry.spec.ts` |
| `#card`·`#ticket`·`#t`·fragment 없음이 모두 같은 화면 | `entry.spec.ts` |
| 참조값이 주소창·히스토리에 남지 않는다 (재스캔 포함) | `entry.spec.ts`, `soak.spec.ts` |
| 폐지된 공개 환자조회 API 호출 **0회** | `invariants.spec.ts` |
| 참조값이 네트워크·콘솔·저장소에 새지 않는다 | `invariants.spec.ts` |
| 위치 API는 진입 시 **1회만** | `invariants.spec.ts` |
| 환자 정보·"인증 완료" 문구 비노출 | `invariants.spec.ts` |
| 권한 거절·시간 초과·미지원·503에서도 119 유지 | `failures.spec.ts` |
| WCAG 2.1 A/AA 위반 0건 | `a11y.spec.ts` |
| 반복 진입 20회 연속 성공 | `soak.spec.ts` |

실제 기기에서의 전화 연결·스피커폰 전환·위치 권한 흐름은 자동화할 수 없다. 배포본으로 직접 확인한다.

## 6. 개발

```bash
npm ci
npm run dev        # http://localhost:5173  (.env.example → .env.local 복사)
npm run build      # tsc + vite build
npm test           # Playwright E2E (mobile-safari + mobile-chrome)
```

위치 기능은 **HTTPS 또는 localhost**에서만 동작한다(브라우저 정책). 휴대폰 실기기로 볼 때는
`npm run dev -- --host` 로 띄우고 터널을 쓰거나 배포본을 확인한다.

E2E는 역지오코딩을 `page.route`로 고정하고 Playwright 권한 API로 위치를 준다 — 실 위치·실
네트워크에 기대면 단언이 흔들리고, 권한 거절·503 같은 실패는 mock이라야 재현된다.

CI(`.github/workflows/ci.yml`)는 typecheck + build + E2E를 돌린다.
배포(`deploy-micro.yml`)는 `main` 푸시 시 NCP micro로 정적 파일만 올린다.

## 7. 관련 저장소

| 저장소 | 역할 |
|---|---|
| [`block-optimization/backend`](https://github.com/block-optimization/backend) | API · 역지오코딩 · 의료진 인증 조회 |
| [`block-optimization/blockchain`](https://github.com/block-optimization/blockchain) | Audit anchor contract + worker |
| [`block-optimization/frontend`](https://github.com/block-optimization/frontend) | 환자 앱 · 의료진 앱 |
| [`block-optimization/docs`](https://github.com/block-optimization/docs) | 프로젝트 문서 |

## 8. 남은 일

- [ ] 실기기 검증 — 119 전화 연결, 스피커폰 전환, 위치 권한 3종(허용·거절·시간 초과)
- [ ] 배포본에서 폐지 API 호출 0회 재확인 (구버전이 캐시로 남아 있지 않은지)
- [ ] 응급처치 가이드 콘텐츠를 백엔드 `/v1/guides`로 이관 (현재 번들 상수 + PDF)
- [ ] Lighthouse mobile 회귀 파이프라인

---

## 라이선스

Apache-2.0 — [LICENSE](LICENSE)
