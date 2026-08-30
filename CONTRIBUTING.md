# Contributing

## Branches

- `main` is the protected release branch.
- `dev` is the integration branch.
- Feature work starts from `dev` and uses `feature/<name>`.

Use Conventional Commits. Keep commits reviewable and include the rationale,
security impact, and validation performed in the commit body.

## Safety baseline

- Use synthetic data only. Never add patient, clinician, employee, or customer
  information to source, fixtures, logs, screenshots, or issue text.
- Do not commit credentials, private keys, tokens, local environment files, or
  generated build artifacts.
- Treat authentication, disclosure policy, audit payloads, and token lifecycle
  changes as security-sensitive and include negative tests where relevant.
- Do not claim regulatory or standards conformance without an independent,
  documented certification process.

## Local development

Prerequisites: Node 20 LTS (or the version pinned in the org's tooling matrix).

```bash
npm ci
cp .env.example .env.local          # 필요 시 값을 수정
npm run dev                         # http://localhost:5173
```

`.env.local` 의 `VITE_USE_REAL_BACKEND=false` 이면 mock 응답을 사용해 백엔드 없이
전 화면 동작을 확인할 수 있다. 실서버 연동은 [BACKEND_INTEGRATION.md](docs/BACKEND_INTEGRATION.md)
를 참고한다.

## Required checks

All PRs must pass:

- `npm run build` — TypeScript strict + Vite production build

권장:

- Playwright / Cypress E2E (P0-12 20회 연속 성공 시나리오) — 추후 추가 예정
- Lighthouse mobile · accessibility 회귀 — 추후 추가 예정

## Boundaries

Do NOT introduce in this repository:

- Blockchain client libraries (ethers, viem, wagmi, web3, walletconnect …).
  Audit anchoring is a Backend/Worker concern; the finder-facing web is a
  passive consumer of already-filtered data.
- Third-party analytics / telemetry SDKs without a documented redaction filter
  for tickets, session IDs, and PHI.
- Direct calls to Backend `/internal/*`, `/metrics`, `INTERNAL_SERVICE_TOKEN`,
  worker RPC, or registry addresses. See the workspace `docs/frontend-api-integration.md`
  for the exact allowed surface.
