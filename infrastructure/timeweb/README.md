# Server timer candidate (not installed)

The GitHub workflow has only been observed running through workflow_dispatch.
Timeweb is an existing user hosting account; batch SSH authentication currently fails.
This is a prepared deployment candidate, not evidence of an active timer.

After user authorizes storing the dispatch key on Timeweb and supplies access through
the hosting panel or SSH, install outside the web root:

- /home/c/cy325019/.astro-reminders/dispatch.sh (0700)
- /home/c/cy325019/.astro-reminders/curl.conf (0600), containing the Authorization header
- directory permission 0700; no bot token, source or location data is copied there

Preserve the existing crontab. Add exactly one entry, with a reviewed backup:

    * * * * * /bin/sh /home/c/cy325019/.astro-reminders/dispatch.sh >> /home/c/cy325019/.astro-reminders/dispatch.log 2>&1

Verify a timer-triggered run and /api/health before enabling normal reminders.
The endpoint atomically claims records and handles overlapping invocations. A manual
run or immediate test must not update automatic scheduler readiness.
