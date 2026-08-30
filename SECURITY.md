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

- QR ticket is carried in the URL fragment (`#t=<token>`), stripped from the
  address bar and history before the first render, and never written to logs or
  localStorage. See `MEDIVC_MASTER_PLAN` §5.
- No blockchain client, wallet, or RPC library is bundled. Emergency access
  responses are rendered without waiting for chain state; the finder is not the
  audit consumer.
- No stable patient identifier is present in the response body or subsequent
  client-to-server calls. The opaque `accessSessionId` issued by the server is
  the only handle used for follow-up actions (emergency-contact dial, etc.).
- Failure states never render medical information. The 119 call button remains
  reachable on every screen.
- No third-party analytics, telemetry, or error-reporting SDK is included by
  default. Any addition must ship with a redaction filter that drops tickets,
  session IDs, and PHI.

## What must never be committed

- `.env` files with real API tokens, keys, or backend credentials
- Any real patient, clinician, employee, or customer information — including
  in fixtures, screenshots, issue text, or Vercel/Netlify preview URLs
- Signing keys, JWT signing secrets, or Backend `INTERNAL_SERVICE_TOKEN`
- Screenshots that reveal QR tickets or manual codes for real cards
