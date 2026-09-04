# Observer App Implementation Plan

> Execute inline; narrowly scoped background and mark asset generation delegated per image-to-code skill.

**Goal:** Deliver the approved mobile screen with real dynamic localized observing opportunities, location selection, details, saved plans and calendar reminders.
**Architecture:** Existing Python repository retained; new isolated React/Vite mobile preview consumes browser Astronomy Engine through a worker. Place lookup is the only network data dependency; no false Telegram send state.
**Tech Stack:** React, TypeScript, Astronomy Engine, Manrope, Phosphor, Radix-based sheets and shadcn-style editable button primitive.
**Spec:** ../specs/2026-09-04-observer-app.md

## Constraints
- Preserve web protected mobile runtime and existing Python backend.
- No destructive database fixtures, deletion, or production deployment.
- No manually repeated ten-year event catalog or fabricated live data.

## Tasks
- [x] Create isolated checkout branch codex/smotri-na-nebo and bootstrap mobile runtime.
- [x] Test calculations before implementation: known full-moon date, opposition, below-horizon/daylight exclusion, local-window ordering, timezone formatting and ICS alarms. Added stable-grid and eclipse-maximum regressions; 9 tests pass.
- [x] Implement web/src/domain/{astronomy,observation,format,calendar,locations}.ts and web/src/events.worker.ts. Pure DTO boundaries; worker accepts place/current instant and returns a 365-day catalog or error.
- [x] Implement web/src/Prototype.tsx with fixed header, bottom tabs, central event, loading/no-location/empty/error states. Add location and reminder BottomSheets; use runtime keyboard-aware text input. Match approved image using supplied raster assets.
- [x] Wire saved plans with versioned local storage and ICS calendar export; assert no notification-delivery claims. Actual Chrome download verified; IAB fallback documented.
- [x] Validate npm test, npm run build, npm run check:runtime. Use CUA to inspect desktop preview and both device sizes; test city lookup, event details, saving and refresh persistence. Record web/design-qa.md and web/README.md usage/limits. Independent review findings fixed and confirmed.
