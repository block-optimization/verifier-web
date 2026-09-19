# Security policy

## Supported versions

Only the latest revision of the active development and release branches is
supported during the MVP phase.

## Reporting

Do not disclose suspected vulnerabilities in a public issue. Contact the
repository maintainers through the private security-reporting channel configured
for the GitHub organization.

Reports should include a minimal reproduction using synthetic data, affected
revision, impact, and suggested mitigation. Do not include real medical or
identity information.

## Demonstration boundary

MediVC verifier-web is demonstration software. It is not approved for clinical
decisions, emergency dispatch, production identity verification, or storage of
protected health information. The demo credentials it renders are not certified
OpenDID, Mobile ID, or W3C Verifiable Credentials conformance.

## Frontend-specific baseline

The finder-facing web app enforces the following invariants. Any change that
weakens them requires review under this policy:

- The bracelet reference (`#card=<reference>`, legacy `#ticket=`/`#t=`) is carried
  in the URL fragment. This app never reads it: it is stripped from the address bar
  and history before the first render, and again on `hashchange`. It is never sent
  to a server, analytics tool, error reporter, or log.
- No per-patient lookup is performed. Every finder sees the same 119 guidance
  regardless of which bracelet was scanned. Patient identification happens only in
  the authenticated clinician app, enforced by the backend.
- The retired public disclosure endpoints (`/api/public/v1/card-sessions`,
  `/api/public/v1/emergency-access`, `report-complete`) are never called. Their 410
  `PUBLIC_DISCLOSURE_RETIRED` means the capability was withdrawn, not that a patient
  revoked a card, and must never be surfaced as a revocation.
- The only backend call is `POST /api/public/v1/location/reverse-geocode`, which
  receives coordinates alone. It creates no medical-access record and no chain event.
  The Naver Maps client secret lives on the backend only, never in this bundle.
- No patient name, medical information, guardian contact, or card-validity claim is
  rendered. The UI never states that a card or patient was verified.
- No blockchain client, wallet, or RPC library is bundled; the finder is not the
  audit consumer.
- Failure states never block emergency use. The 119 call button remains reachable on
  every screen, including when location permission is denied or the address lookup
  returns 503.
- No third-party analytics, telemetry, or error-reporting SDK is included by
  default. Any addition must ship with a redaction filter that drops URL fragments
  and PHI.

## What must never be committed

- `.env` files with real API tokens, keys, or backend credentials
- Any real patient, clinician, employee, or customer information — including
  in fixtures, screenshots, issue text, or Vercel/Netlify preview URLs
- Signing keys, JWT signing secrets, or Backend `INTERNAL_SERVICE_TOKEN`
- Screenshots that reveal the QR fragment of a real bracelet
