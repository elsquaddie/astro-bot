# Reminder timer on Selectel

The user confirmed Selectel on 2026-09-05. Timeweb is obsolete.

## Runtime

- SSH: `root@135.106.179.134`.
- The Mini App, D1 reminder queue, Telegram webhook and bot token remain on Sites:
  https://smotri-na-nebo.vektordaniil1.chatgpt.site/.
- `astro-reminders.timer` runs every minute and starts `astro-reminders.service`.
- The service POSTs `/api/reminders/dispatch`, authenticated with a separate dispatch
  credential and `X-Dispatch-Trigger: schedule`. Only this scheduled path updates
  the scheduler heartbeat. A manual GitHub run remains available for recovery.
- `astro-reminders-proxy.service` provides a private SOCKS endpoint on
  `127.0.0.1:1087`, using Kazakhstan XHTTP from the existing VPN subscription.
  The shared `shadowlos-proxy.service`, its settings and port 1080 are unchanged.
- Both timer and private proxy are enabled at boot. No local computer is required.

Direct Selectel requests to the Sites domain received Cloudflare HTTP 403. The
shared VPN had stale nodes. `prepare-xhttp.py` reads the fresh subscription on the
server and verifies the actual app health endpoint before writing a new config.
The Kazakhstan server is pinned deliberately; if the provider changes it, inspect
the new subscription and update the converter before preparing another version.

## Private files (not in Git)

`/etc/astro-reminders` is root-owned, mode 0700:

- `curl.conf` (0600): only the dispatch Authorization header. Never the bot token.
- `proxy-v1.json` (0600): the verified Kazakhstan XHTTP config.

Units use systemd `LoadCredential` and `DynamicUser`; credentials are not embedded
in unit files or command arguments. Preserve old versioned configs when updating.
Do not print secrets, put them in archives, or paste the subscription into logs.

The isolated binary is `/opt/astro-reminders/bin/xray-v26.3.27`. Its official archive:
https://github.com/XTLS/Xray-core/releases/download/v26.3.27/Xray-linux-64.zip

Verified SHA-256:
`23cd9af937744d97776ee35ecad4972cf4b2109d1e0fe6be9930467608f7c8ae`.
Only `xray` was extracted into the new product directory; no system package or
shared VPN binary was replaced.

`prepare-proxy.py` is an unused sing-box diagnostic retained from the connectivity
investigation. Do not use its output with the production Xray unit.

## Verification and maintenance

Run on Selectel:

```sh
systemctl list-timers --all astro-reminders.timer --no-pager
systemctl show astro-reminders.service -p Result -p ExecMainStatus
journalctl -u astro-reminders.service --since "10 minutes ago" --no-pager
curl --fail --silent --show-error --max-time 20 \
  --proxy socks5h://127.0.0.1:1087 \
  https://smotri-na-nebo.vektordaniil1.chatgpt.site/api/health
```

Require successive calendar-triggered runs, not a manual start, before claiming the
timer works. The app health response should report `reminders: true`. A scheduler
run with `sent: 0` is expected when no reminders are due; it does not prove delivery
to a phone. A real test message was separately acknowledged by the user.

The dispatcher uses atomic queue claims. Runs of one systemd service do not overlap;
its timeout is 200 seconds and curl timeout is 180 seconds. Timer cadence is one
minute, so event reminders can arrive after their nominal time by that interval
plus network/Telegram latency. The UI delivery-test button sends immediately and
does not wait for this timer.

VPN provider availability and the Sites endpoint are operational dependencies.
When delivery stops, inspect the service journal and proxy first. Do not switch the
shared VPN or mark a manual message test as evidence of automatic delivery.

## Installation evidence — 2026-09-05

Calendar-triggered runs at 13:19 and 13:20 UTC both returned
`{"ok":true,"sent":0,"failed":0}`. Public health then reported `reminders: true`.
Both new units were enabled; the shared VPN retained PID 732 and its original
2026-08-16 start time. GitHub main commit `aafd7c9` removed its automatic schedule.
No due event was sent by these two runs; they establish the working timer and
authenticated endpoint, alongside the separately confirmed real test message.
