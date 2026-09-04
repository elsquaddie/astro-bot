# Смотри на небо. — accepted observer screen

Approved in conversation: a compact lunar-ring mark and two-line name with periwinkle period, header aligned with the city, cozy dark mountain sky, central nearest visible event, date/equipment and reminder button above Today/Events/Saved bottom navigation. No marketing slogans. Reference: /Users/dlotochkov/.codex/generated_images/01a06dcd-ffc8-7d42-9aca-1994b894087c/exec-1aabecca-6d56-4b68-ad08-fff3752a0437.png.

First working slice: React mobile preview in web/, live date, explicit initial city selection, opt-in device geolocation, Open-Meteo city lookup, locally computed rolling 365-day catalog using Astronomy Engine. Include lunar quarters/full moons, close Moon/planet approaches, visible lunar eclipses and outer-planet oppositions if sufficiently visible. No hardcoded repeated annual meteor dates. Expose exact coverage and source in details.

Calculate observation windows for each place, excluding daylight and below-horizon targets. Sort by start of local observing window, not global peak. Live global peak and local viewing time are separate fields. Localized Russian names; equipment states distinguish naked-eye visibility from telescope detail.

An asynchronous Web Worker prevents calculation from blocking the interface. Changing location cancels stale computation. Cache only versioned place/date results. Loading/error/empty states are explicit. Do not show Samara as a detected location until user selects it.

Reminder sheet supports lead time, local saved list and calendar export with a VALARM. Explain local saving does not send notifications; Telegram is not connected. No token or shared API key in frontend. Preserve existing backend unchanged in this slice. User can inspect a working preview without PostgreSQL.
