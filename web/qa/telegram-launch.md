# Telegram launch — 2026-09-05

Published: https://smotri-na-nebo.vektordaniil1.chatgpt.site
Bot: https://t.me/astro_timing_bot

- Sites public deployment succeeded, version 1, source 2a57ef99da233aaa18df7745505cbc0edd03cf9a.
- 14 local tests passed; protected runtime 28/28 unchanged; standalone/Telegram build passed. Independent read-only review found no important launch issues.
- Production /api/health returned 200 and truthful reminders:false. Python urllib default user agent was blocked by the hosting edge (1010); standard curl succeeded.
- Bot API confirmed setMyName, descriptions, commands, setChatMenuButton and setWebhook. getChatMenuButton and getWebhookInfo matched the published URL; pending updates 0 at setup.
- Production webhook rejected missing secret (401). Authenticated direct HTTP /start simulation returned the expected sendMessage method with fixed Mini App button. Direct simulation does not deliver a Telegram message.
- No user chat was messaged by the agent; actual /start delivery and physical-client Mini App launch await user interaction.
- Bot token stays in ignored local .env with mode0600. The publication contains no token or webhook secret. Sites stores only the webhook secret and app URL at runtime.
- This release opens the Mini App and supports local saved events. Delayed reminders remain disconnected: no persistent scheduler has been deployed.
