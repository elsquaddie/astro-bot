#!/bin/sh
set -eu
# Install outside public_html. curl.conf contains only the dispatch bearer header,
# mode 0600. The bot token stays in the application hosting environment.
curl --fail --silent --show-error --max-time 180 \
  --config /home/c/cy325019/.astro-reminders/curl.conf \
  --request POST --header 'X-Dispatch-Trigger: schedule' \
  'https://smotri-na-nebo.vektordaniil1.chatgpt.site/api/reminders/dispatch'
