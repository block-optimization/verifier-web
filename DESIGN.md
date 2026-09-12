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

`App.tsx` owns landing → verifying → information/error transitions. Bracelet scanning
uses the same Verifying, EmergencyInfo and ErrorScreen as existing ticket/manual entry.
`api/emergencyAccess.ts` owns PUBLIC reference exchange and response adaptation.
No responder authentication is simulated in this bystander viewer.

Strip QR fragments before rendering; never persist or log references or tickets.
One scan performs one exchange and one consumption, including StrictMode effect replay.
Network operations have a timeout; existing error recovery returns to scanning/manual entry.
119 remains accessible on success and failure. Existing reduced-motion styles are retained.

## Do's and Don'ts

- Do preserve the existing Korean copy and sibling screen layout.
- Do use existing loading/error states for both request steps.
- Do not display or cache raw bracelet references in a control or browser storage.
- Do not claim temporary tickets prevent a copied bracelet QR from being reused.
