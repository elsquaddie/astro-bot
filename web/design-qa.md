# Design QA — Смотри на небо.

Checked 2026-09-05, Europe/Samara. Final result: passed

## Source and evidence

- Source visual truth: `/Users/dlotochkov/.codex/generated_images/01a06dcd-ffc8-7d42-9aca-1994b894087c/exec-1aabecca-6d56-4b68-ad08-fff3752a0437.png`, also `qa/approved-source.png`.
- Rendered app: http://127.0.0.1:8875/; final app capture `qa/implementation-iphone.png`.
- Same-input comparison: `qa/comparison.html`; paired upper/hero view `qa/side-by-side.png`, paired lower/action/nav view `qa/comparison-bottom.png`. Both source and implementation were visible together before judging. Earlier full-view board was also inspected during capture troubleshooting.
- Source 853 × 1844 px rendered at 393 × approximately 850 CSS px. App content measured 392.998 × 851.992 CSS px (iPhone 393 × 852); final screenshot is 393 × 852 approximately, including live system overlays. The source has no system bar/home indicator, an expected mobile-runtime difference.
- Chrome QA viewport requested 1400 × 1200; the user's 80% browser zoom exposes 1750 × 1500 CSS viewport, DPR .8. Screen capture clip coordinates were normalized by .8 to obtain a 1:1 app-content image. Incorrect earlier clips were not used to assess fidelity. No browser zoom preference was changed. Temporary viewport overrides are reset at handoff.
- State: Samara selected, current date rather than a frozen demonstration date, real last-quarter Moon event. The concept contains a different event (Draconids); literal text wrapping/line count is therefore intentionally different.

## Comparison history and resolved findings

1. Initial rendered-screen check: subtitle inherited the template's gray paragraph color, too dark over the sky (P2). App paragraph inheritance corrected; the final paired hero view confirms ivory body text and a readable muted label.
2. Reminder sheet opening: Radix autofocus scrolled the entire hidden-overflow phone viewport, exposing the offscreen keyboard and clipping the title (P1). Root cause observed as `device-screen.scrollTop = 275.5` while keyboard state was false. App-scoped `overflow: clip` prevents scrolling this clipping viewport. Reopened sheet after reload: scrollTop 0, title and controls visible, keyboard hidden. Protected runtime file hashes unchanged.
3. City selection while text field focused: blur moved the sheet between mouse-down and mouse-up, requiring a second click (P2). Button mouse-down retains focus until click completes; selecting Kazan now closes the keyboard and sheet on one click, then recomputes events. Keyboard navigation still dismisses on blur.
4. Final paired image comparison after these fixes: no actionable P0/P1/P2 visual differences remain. See paired upper and lower captures above.

## Required fidelity surfaces

- **Typography:** Manrope Cyrillic/Latin loaded locally, thin display weight 300, body 400, controls 500. Hero 43px, two-line real event fits without clipping. Name intentionally larger than source's compact wordmark, matching the user's request. Local times are ordinary readable text; no scientific notation leaks into the hero.
- **Spacing/layout:** Ring/name and location share a vertical center. Long Saint Petersburg label wraps to two lines on iPhone and fits on Pixel without colliding with the mark. Central event hierarchy retained. Date/equipment and reminder remain above the three-item bottom nav. Safe-area home indicator accounts for the upward shift of bottom controls relative to the chrome-free mock.
- **Colors:** Cozy deep navy, warm ivory, muted gray-lilac, periwinkle action and selected-nav accent. Primary text contrast fixed. Small metadata is intentionally secondary. No bright card stack added over the sky.
- **Imagery:** Generated dark mountain/valley background and transparent raster ring mark used. No CSS/SVG substitute for the custom image assets. Decorative crescent removed to avoid implying a false current Moon phase; background remains illustrative. Fine ring edges are acceptable at 40px, vector cleanup is P3 polish before brand production use.
- **Copy:** Exact name “Смотри на небо.” with colored final period. No slogans. Actual event title and local date replace the mock's Draconids. “Без телескопа” has a detailed optics explanation. No fake Telegram notification success.

## Browser flows and technical validation

- First launch asks for city; no location is falsely presented as detected.
- Samara manual selection; Russian live Open-Meteo search for Kazan; single-click result selection with keyboard open; Saint Petersburg long label.
- Today, Events and Saved navigation; real yearly list; event details with local observing window, equipment and source explanation.
- Reminder lead times; unavailable past lead disabled; saving and reload persistence.
- Actual Chrome download `/Users/dlotochkov/Downloads/smotri-na-nebo.ics` inspected: `DTSTART:20260905T011000Z`, Samara 05:10, `VALARM` with `TRIGGER:-PT60M`.
- IAB Blob download did not complete; ordinary-browser fallback is explicit. Calendar import and actual OS notification delivery were not invoked.
- iPhone 393 × 852 and Pixel 427 × 952 visually inspected, including device/nav assets. No missing images in DOM check. Device rendering remains template-owned.
- Console error/warning log checked in IAB: no app errors. No real device geolocation permission was granted during QA; manual city path verified. GPS permission/error behavior remains a device-level validation gap.
- `npm test`: 9 passing domain tests, including local midnight, known lunar phase/opposition, daylight exclusion, year 2031, deterministic recommendation grid, 2028 eclipse maximum, malformed storage and UTF-8 ICS folding.
- Independent reviewer identified and confirmed fixes for eclipse timing and Events error state. Error/retry presentation is code-reviewed; network/worker outage is not browser fault-injected.
- `npm run build` and protected runtime check pass. Vite reports an initial JS chunk above 500kB; bundle splitting is follow-up work before release.

## Follow-up polish and limits

- P3: vector production version of mark; reduce initial JS bundle; real device keyboard/GPS/calendar import checks.
- Weather, Telegram delivery, meteor catalogs, AR and installation are outside this first client slice. No deployment or public release performed.

## Implementation checklist

- [x] Approved composition implemented with current data.
- [x] Major visual and interaction defects corrected and rechecked.
- [x] Domain checks, production build and runtime integrity checked.
- [x] Final side-by-side evidence and limitations recorded.

final result: passed
