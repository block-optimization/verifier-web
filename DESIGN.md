---
version: alpha
name: MediVC verifier-web
description: Korean mobile emergency demo viewer with an always-reachable 119 action.
colors:
  ink: '#14131c'
  paper: '#f6f3ef'
  brand: '#6558ff'
  danger: '#e13c46'
typography:
  sans:
    fontFamily: "'Pretendard Variable', Pretendard, 'Apple SD Gothic Neo', 'Malgun Gothic', system-ui, sans-serif"
rounded:
  sm: '10px'
  md: '16px'
  lg: '22px'
  xl: '28px'
spacing:
  page-max: '480px'
  sticky-height: '108px'
---

## Overview

Product register: Korean-speaking bystanders scan a bracelet on a mobile phone.
Preserve the existing translucent surface language and prominent coral 119 action;
this is synthetic demonstration software, not an approved clinical tool.
No visual redesign is part of reusable-bracelet support.

## Colors

`src/styles.css` is the canonical runtime token source; this file mirrors its base
palette. Semantic danger is reserved for the 119 action and existing error language.
Dark-mode overrides remain owned by the same stylesheet.

## Typography

Reuse the existing Pretendard/system Korean fallback stack and weight-based hierarchy.
Do not add remote font services or change fonts for the scan flow.

## Layout

Keep the 480px mobile content column, safe-area padding, and 108px sticky call dock.
The normal document owns scrolling. No new panels or input controls are required.

## Elevation & Depth

Keep existing translucent fills, borders and shadows from `src/styles.css`.

## Shapes

Reuse the four runtime radius sizes; no feature-local shape tokens.

## Components

`App.tsx` owns the report ↔ guide transition — there is no landing, verifying or error
screen, because nothing is looked up. Every scan lands on `screens/EmergencyReport.tsx`:
question → 119 button → speakerphone note → location → report script.
`api/location.ts` owns geolocation and the backend reverse-geocode call.

Strip QR fragments before rendering and on `hashchange`; never read, persist or log the
reference. Call the location API once per entry (or on explicit retry), not per GPS event,
including under StrictMode effect replay. Network operations have a timeout; location
failure degrades to the official "address unknown" guidance.
119 remains accessible on success and failure. Existing reduced-motion styles are retained.

## Do's and Don'ts

- Do preserve the existing Korean copy and sibling screen layout.
- Do keep the location card's loading/error states visually secondary to the 119 action.
- Do not display or cache raw bracelet references in a control or browser storage.
- Do not imply the card, the patient, or the bracelet was verified — nothing is checked.
