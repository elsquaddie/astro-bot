# Смотри на небо.

Устанавливаемое веб-приложение AstroBot. React + TypeScript + Vite. Запускается отдельно от Python API и базы данных.

## Запуск и проверки

Требуется Node.js 22.12+ (Vite 8). Из `web/`:

```bash
npm ci
npm run build:app
npm run start:app
npm test
npm run build
npm run check:runtime
```

Открыть http://127.0.0.1:8876/. Это самостоятельное приложение без рамки телефона. «Сохранено» → «Установить приложение» запускает установку в поддерживающем браузере либо показывает, где найти её в меню. На iPhone используется Safari → «Поделиться» → «На экран Домой». Вне localhost нужны HTTPS и отдельный origin. Установка на физический телефон в этой задаче не проверялась.

`npm run build:app` создаёт `dist-app/`: HTML, стили, шрифты, рисунок, Web Worker, manifest и service worker. `emptyOutDir: false` сохраняет предыдущие файлы; precache включает только текущую сборку. Старые кэши и файлы автоматически не удаляются. После первой полной загрузки события рассчитываются без сети, сохранённые планы остаются доступны. Поиск новых городов требует сети. Новая версия сначала загружается в отдельный кэш; кнопка обновления переключает открытые окна на неё.

Предыдущее окружение iPhone / Pixel сохранено отдельно: `npm run dev -- --host 127.0.0.1 --port 8875 --strictPort`. Его 28 защищённых файлов не менялись. Для проверки превью без очистки используйте `npx tsc && npx vite build --emptyOutDir false`, затем `node scripts/prepare-sites-build.mjs`. Публикация не выполнялась.

## Что работает

- Выбор города, поиск через Open-Meteo на русском, геолокация только после нажатия. Расчёт на экране идёт локально. При создании напоминания выбранное место сохраняется на сервере приложения; при поиске провайдер получает название города.
- Ближайшее подходящее окно наблюдения, дата, местное время, направление и пояснение об оптике.
- Динамический каталог следующих 365 дней: четверти/полнолуния, сближения Луны с Венерой, Марсом, Юпитером и Сатурном, противостояния внешних ярких планет, теневые лунные затмения.
- Локальное сохранение в браузере; серверные напоминания внутри Telegram при доступной доставке. Скачивания календаря нет.
- Состояния первого запуска, расчёта, ошибок, пустого каталога и пустого сохранённого списка.

Локальное сохранение не отправляет уведомления. В Telegram доступна серверная очередь напоминаний; создание включается только при работающем таймере. Существующий модуль ICS сохранён в исходниках и тестах, но не используется интерфейсом.

## Откуда берутся события

[Astronomy Engine](https://github.com/cosinekitty/astronomy) вычисляет астрономические моменты локально в Web Worker. Нет списка заранее записанных событий на 10 лет. После выбора места строится новый годовой горизонт, с повторным расчётом каждые 10 минут открытой страницы. Смена города завершает предыдущий worker, поэтому старые результаты не заменяют новые.

Окна проверяются на фиксированной сетке в 10 минут. Солнце должно быть ниже −6°, объект — выше 8°; для сближений проверяются оба объекта и топоцентрическое расстояние не более 6°. Отбрасываются окна короче 20 минут. Для фаз/сближений берётся интервал вокруг события ±18 часов, для противостояний ±24 часа, для затмений — теневые контакты. В каталоге показывается первое подходящее окно. Для обычного наблюдения рекомендуется самый высокий объект в этом окне; для затмения — видимый момент, ближайший к максимальной фазе. Глобальный момент события отдельно указан в подробностях.

Это геометрическая видимость, а не гарантия хороших условий. Погода, засветка, здания, рельеф горизонта и высота наблюдателя не учтены. Метеорные потоки, спутники, кометы, солнечные затмения и AR-карта пока не входят в каталог. Небо на фоне — иллюстрация, не карта фактического положения звёзд.

[Open-Meteo Geocoding](https://open-meteo.com/en/docs/geocoding-api) нужен только для текстового поиска городов. Три стартовых города доступны без геокодинга. Часовой пояс координат определяется локально через `tz-lookup`; даты отображаются через `Intl.DateTimeFormat` с выбранной IANA-зоной. Для коммерческого размещения нужно отдельно проверить действующие условия провайдера.

## Структура

| Путь | Назначение |
| --- | --- |
| `src/Prototype.tsx`, `src/prototype.css` | Экран, навигация и тема |
| `src/components/` | Выбор города, подробности, напоминание, списки |
| `src/domain/astronomy.ts`, `observation.ts` | События и локальные окна видимости |
| `src/domain/format.ts`, `calendar.ts` | Местное время и ICS |
| `src/domain/locations.ts`, `storage.ts` | Места и проверяемое локальное хранение |
| `src/events.worker.ts`, `src/useEvents.ts` | Фоновый расчёт и отмена устаревших запросов |
| `tests/*.test.ts` | Проверки дат, горизонта, полярного дня, затмений, timezone и ICS |
| `src/application/`, `application/`, `vite.application.config.ts` | Самостоятельный вход, настоящая клавиатура, установка и офлайн |
| `src/platform.ts` | Адаптер превью; отдельная сборка подключает нативные контролы |
| `src/mobile/` | Защищённое мобильное окружение шаблона |
| `qa/`, `design-qa.md` | Визуальная сверка и её результаты |

UI: локальные Manrope 300/400/500 с кириллицей, Phosphor Light, Radix Dialog для нижних окон и редактируемая кнопка на Radix Slot/cva по принципу shadcn/ui. Это небольшая собственная тема компонентов, а не установленный целиком сторонний визуальный kit. Фон и знак созданы из согласованного концепта.

Браузер и сервер используют общий расчёт Astronomy Engine. Сервер проверяет подпись Telegram и сохраняет напоминания в D1. Токены бота и секреты не должны попадать в браузер.

## Основания для PWA

Установка и manifest: [MDN](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable). Отдельная сборка: [Vite build options](https://vite.dev/config/build-options). Кэш содержит локальные шрифты и worker расчётов, внешние ответы геокодинга не перехватываются. Секретов и серверных токенов в сборке нет.

## Telegram Mini App

Бот: `@astro_timing_bot`. `npm run build:telegram` собирает самостоятельное приложение и Worker для Sites в `dist-telegram/`. Защищённый телефонный шаблон не используется в публикации.

- `/start` и `/help` в личном чате возвращают кнопку Mini App. Обработчик проверяет секрет Telegram webhook; сообщение отправляется только в исходный личный чат.
- SDK Telegram загружается только при запуске из Telegram; приложение учитывает безопасные отступы и скрывает установку PWA.
- Токен бота остаётся в локальном `.env`, не входит в публикацию. Worker использует `TELEGRAM_WEBHOOK_SECRET` и `TELEGRAM_APP_URL` из секретов/настроек Sites.
- `/api/health` показывает возможности опубликованной версии. Готовность доставки требует runtime-секреты, D1 и запуск диспетчера за последний час. Подготовленный GitHub Actions workflow нуждается в отдельном подключении; его наличие в коде не подтверждает доставку.
- Источник протокола: https://core.telegram.org/bots/webapps и https://core.telegram.org/bots/api.

### Reminder runtime

`POST /api/reminders` checks the signed Telegram initData header, recalculates the canonical event, and persists the selected place in D1. The app asks for permission to receive bot messages. GET and cancellation are owner-scoped; active records precede bounded history. Outside Telegram the app only saves locally.

`POST /api/reminders/dispatch` requires a dedicated Bearer secret. `.github/workflows/astro-reminders.yml` is a five-minute timer intended for GitHub main, with repository secret `ASTRO_REMINDER_DISPATCH_SECRET` matching the Sites runtime `REMINDER_DISPATCH_SECRET`. Verify an actual workflow run and `/api/health`; a YAML file alone is not an active scheduler. GitHub schedules may be delayed.

The queue atomically rechecks due time when claiming. Telegram 429/5xx responses retry at most three times. Ambiguous network failures become `uncertain` without blind resend. Ended observation windows expire. Schema changes are generated from `db/schema.ts` with drizzle-kit; deployed migrations are immutable. Queue tests use in-memory SQLite only (Node.js 22.13+).
