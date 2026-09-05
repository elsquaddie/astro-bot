# Смотри на небо. / AstroBot

This is an independent Git repository. Do not apply danlot.ch site deploy/check scripts here.
- Existing Python API/bot remain under src/. New observer application is web/.
- Read web/AGENTS.md before changing its mobile preview runtime. Keep protected files intact.
- Approved visual: docs/superpowers/specs/2026-09-04-observer-app.md.
- Never invent live astronomy, weather or notification success. Label catalog coverage in event details.
- Browser calculations use Astronomy Engine; dates are instants in UTC, presentation uses the selected IANA timezone.
- Geolocation is opt-in. Screen calculations stay local; the app server stores selected coordinates only when the user requests a Telegram reminder.
- Outside Telegram save locally. In Telegram use authenticated D1 reminders. Never claim delivery before Telegram confirms it; creating reminders requires a recent dispatcher heartbeat. Do not restore calendar downloads.
- Do not run existing pytest database fixtures: they drop tables. No destructive command or API without separate exact user approval.
- Validate web with npm test, npm run build, npm run check:runtime and actual browser flows.
- Keep authored app modules below 500 lines. Use agents only for explicitly scoped work.
