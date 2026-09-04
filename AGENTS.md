# Смотри на небо. / AstroBot

This is an independent Git repository. Do not apply danlot.ch site deploy/check scripts here.
- Existing Python API/bot remain under src/. New observer application is web/.
- Read web/AGENTS.md before changing its mobile preview runtime. Keep protected files intact.
- Approved visual: docs/superpowers/specs/2026-09-04-observer-app.md.
- Never invent live astronomy, weather or notification success. Label catalog coverage in event details.
- Browser calculations use Astronomy Engine; dates are instants in UTC, presentation uses the selected IANA timezone.
- Geolocation is opt-in; do not send coordinates to a third party for astronomical calculation.
- Save reminder plans locally and export ICS. Telegram sending is not connected in this first client slice.
- Do not run existing pytest database fixtures: they drop tables. No destructive command or API without separate exact user approval.
- Validate web with npm test, npm run build, npm run check:runtime and actual browser flows.
- Keep authored app modules below 500 lines. Use agents only for explicitly scoped work.
