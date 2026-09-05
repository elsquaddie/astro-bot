# Telegram reminders — 2026-09-05

Published Sites version 2 from commit `6cebad6bb8b2adde23b3142f1927df239634b416`:
https://smotri-na-nebo.vektordaniil1.chatgpt.site/

- Telegram bot avatar uploaded; getUserProfilePhotos returned one photo.
- Live bundle includes native Telegram LocationManager, observing directions and signed reminder API.
- D1 migrations created `reminders` and `service_state`.
- GitHub workflow installed on main as commit `d2ad5feedea698cc4acbf991f72011bee427785f`, after explicit user approval to store its dedicated dispatch key in GitHub Secrets. Bot token stays in Sites runtime.
- First manual workflow run succeeded: https://github.com/elsquaddie/astro-bot/actions/runs/33961165286
- Production `/api/health` reports `reminders: true`; unauthenticated reminder requests return 401.
- 24 app/server tests and 4 static-worker tests passed; both builds pass; all 28 protected runtime files intact. Independent review findings about rescheduling races and active-record visibility were fixed with regression tests.

The scheduler is configured for every five minutes; GitHub can delay scheduled runs. Initial dispatch had no due reminders. Physical-phone location prompts and receipt of a real user reminder were not verified in this run. Open the app through @astro_timing_bot, allow private messages and create a reminder to exercise that final device flow.

For an already cached PWA, use the update button under Saved when offered. Runtime secrets are neither source nor artifacts. Applied Drizzle migrations must remain immutable.
