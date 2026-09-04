# Standalone app — 2026-09-05

## Delivered

- Shared app UI, real browser input and Radix dialogs without simulated phone chrome.
- Humanizer-ru text pass; no calendar download, unnecessary category subtitle or dummy reminder-time selector. Honest saving-only sheet retains the approved main action.
- Separate Vite config/entry. Protected preview runtime remains intact (28/28 hashes).
- Install manifest with approved logo; local fonts, illustration and astronomy worker precached. No remote geocoding caching.
- Versioned service worker; updates are user-triggered and all controlled windows reload. First installation does not reload.

## Evidence

- `npm test`: 12/12, including actual astronomy/timezone/validation tests and offline navigation/worker/external request exclusion/activation contracts.
- `npm run build:app`: TypeScript and production build passed. Standalone JS ~351 kB, gzipped ~118 kB; no device runtime in app bundle.
- Preview build: local tsc, Vite with `--emptyOutDir false`, Sites preparation passed. Preview-only size warning remains (~563 kB JS).
- Browser flow on port 8876: manual Samara selection, calculated nearest event, native city search for Kazan (Tatarstan), long Saint Petersburg label, details, saving, saved list, persistence through new tab, update button reload.
- Offline: stopped the owned Vite preview process; opened a fresh app tab. Cached shell rendered, Samara event recalculated, selecting Saint Petersburg recalculated for its timezone. Restarted preview after the check. This proves the local app/worker path; external geocoding was not called during this offline check.
- IAB screenshots inspected at 393×852, 320×568, and default desktop. Moon remains visible, text/CTA/nav fit. Temporary viewport override reset.
- Chrome CDP `Page.getInstallabilityErrors`: `[]`. No OS installation performed. IAB installability inspection was unsupported; ordinary Chrome provided the validation.
- Independent read-only review found a multi-window controller update issue, corrected and verified by the reviewer. No outstanding important findings.
- Current application tab error/warning log: empty.

## Limits

- Telegram and background reminder delivery are not connected. Local save does not send anything.
- Installation on a physical iPhone/Android and real on-device soft-keyboard/permission prompts were not tested. VisualViewport positioning is implemented; desktop width checks do not replace physical-device testing.
- Existing illustration remains native 853×1844. No generated detail or higher resolution is claimed.
- Publication not performed. Local server is on 127.0.0.1:8876; public installation requires HTTPS. Browser caches and prior build files are retained, not automatically deleted.
