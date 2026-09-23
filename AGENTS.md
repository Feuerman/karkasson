# AGENTS.md

Инструкции для агентов и контрибьюторов, работающих над проектом
«Каркассон Онлайн». Обзор продукта и архитектуры — в [README.md](README.md),
история изменений — в [CHANGELOG.md](CHANGELOG.md).

## Что это за проект

Онлайн-игра Carcassonne: Vue 3 SPA-клиент (`src/`) + игровой сервер
Node.js/Socket.IO (`server/`, pnpm workspace) + персистентность в Firebase
Realtime Database. Тесты — Vitest (unit и интеграционные). Монорепо на
pnpm, деплой клиента — GitHub Pages через Actions.

## Команды

| Команда                          | Назначение                                    |
| -------------------------------- | --------------------------------------------- |
| `pnpm install`                   | установка (включая workspace `server/`)        |
| `pnpm run dev`                   | dev-сервер клиента (Vite)                      |
| `pnpm --filter server run dev`   | сервер с nodemon                               |
| `pnpm run build`                 | сборка клиента в `dist/`                       |
| `pnpm --filter server run build` | компиляция сервера (`tsc` → `server/dist`)     |
| `pnpm test`                      | все тесты                                      |
| `pnpm run type-check`            | `vue-tsc --noEmit`                             |
| `pnpm run lint`                  | ESLint **с `--fix`** — правит файлы сам         |
| `pnpm run format`                | Prettier `--write` по репозиторию              |

Перед завершением задачи обязательно прогнать `pnpm run type-check` и
`pnpm test`; по возможности — `pnpm run lint`.

## Архитектурные ориентиры

- **Доменная модель — в `server/src/modules/types.ts`** (`Player`, `Tile`,
  `GridTile`, `IGameBoard` и др.). Единственный источник истины; клиент
  импортирует её через алиас `@server/*`. Не дублировать типы на клиенте.
- **Правила игры — `server/src/modules/GameManager.ts`** (машина состояний:
  `placeTile`, `placeFollower`, `checkRoads/Cities/Monasteries`,
  `getNextPlayer`) и `server/src/modules/scoring.ts`. Любая игровая логика
  исполняется **только на сервере**.
- **Сокет-слой сервера — `server/src/socket/`**: `router.ts` регистрирует
  обработчики, `handlers/{connection,lobby,game}.ts` — конкретные события.
  Каждый игровой ход защищён проверкой `isPlayersTurn`.
- **Сервисный слой сервера — `server/src/services/`**:
  `GameService.ts` (лобби, слоты, `deviceId→socketId`, сохранение/загрузка
  партий) и `computerPlayer.ts` (цепочка ходов ИИ, guard
  `pendingMoveTimers`).
- **Транспорт клиента — `src/modules/GameService.ts`**: обёртка
  Socket.IO-сокета; два паттерна запросов — `emitAck` (ack-колбэк) и
  `emitAndWait` (событийный). REST/axios не используется.
- **Алиасы**: `@/*` → `src/*`, `@server/*` → `server/src/*`
  (`vite.config.js` и `tsconfig.json`). Использовать их, не относительные
  пути через несколько уровней.
- **Персистентность — `server/src/modules/Database.ts`** (`IGameDatabase`).
  Для тестов — `tests/integration/helpers/inMemoryDatabase.ts`; не писать
  в тестах напрямую в Firebase.
- **UI-кит — Nuxt UI v4** (компоненты `U*`, подключён как Vite- и
  vue-плагин). Дизайн-токены и кастомные классы
  (`panel-parchment`, `btn-stone`, `board-surface`, `title-medieval`) —
  в `src/assets/main.css` (Tailwind v4 `@theme`). Цвета игроков —
  `src/utils/colors.ts`, они же на сервере `PlayerColors` — менять синхронно.
- **Уведомления** — `src/plugins/notification.ts`
  (`notificationService.success/error/warning/info`, default export)
  через `ToastBridge.vue` к тостам Nuxt UI; не вызывать `useToast()`
  напрямую из произвольных мест.

## Соглашения

- **TypeScript строго, без `any`** в новом коде (проект прошёл через
  zero-`any` рефакторинг, см. CHANGELOG 1.7.0).
- **Prettier**: без точек с запятой, одинарные кавычки, отступ 2,
  `trailingComma: es5`, `printWidth: 80`. Не спорить с форматировщиком.
- **ESLint**: конфиг `.eslintrc.json` (классический, не flat config),
  `prettier/prettier` — ошибка.
- **Коммиты**: сообщения на **русском**, императив/описание, часто с
  префиксом области (`Server`, `Client`, `Changelog:`). Conventional
  commits (`feat:`/`fix:`) в проекте **не используются**.
- **Версии и CHANGELOG**: SemVer, в `package.json`; каждый релиз — запись
  в `CHANGELOG.md` в формате Keep a Changelog (Russian), обычно отдельным
  коммитом `Changelog: ...`. Значимое изменение без записи в CHANGELOG —
  недоделка.
- **Типы клиентских сокетов** — в `src/types/socket.ts` (`SocketAck`,
  payload-и); при добавлении события обновить обе стороны: клиентский
  метод в `GameService`, обработчик на сервере, тип.
- **Тесты обязательны** для логики сервера: юнит — для чистых функций
  (scoring и т.п.), интеграционный — для сценариев через реальный
  `createGameServer` + TestClient (`tests/integration/helpers/`).

## Тесты

- Конфиг: `vitest.integration.config.ts` (окружение node, include
  `tests/**/*.test.ts` — подхватывает unit и integration).
- Файлы гоняются **последовательно** (`fileParallelism: false`), таймауты
  30 с / hook 60 с, `COMPUTER_MOVE_DELAY_MS=100` — не полагаться на
  дефолтную задержку ИИ в 1 с.
- Helpers: `client.ts` (TestClient), `server.ts` (startTestServer),
  `frontend.ts` (запуск настоящего Vite-фронтенда), `inMemoryDatabase.ts`,
  `lobby.ts`, `gameplay.ts`.
- Запуск: `pnpm test`. Перед сдачей — убедиться, что весь набор зелёный.

## Переменные окружения

- `VITE_SERVER_URL` — адрес игрового сервера для клиента (прод:
  `https://karkasson.onrender.com`; локально — `http://localhost:3001`).
- `PORT` — порт сервера (по умолчанию `3001`).
- `COMPUTER_MOVE_DELAY_MS` — задержка хода ИИ (по умолчанию `1000`).

Файлов `.env` в репозитории нет; при добавлении — не коммитить секреты и
добавить `.env.example`.

## Известные проблемы и подводные камни

- **Firebase-конфиг закоммичен** в `server/src/config.ts` (project
  `karkassone-a5080`, databaseURL). Считать его несекретным (правила БД —
  на стороне Firebase), но **не добавлять туда новые ключи/токены**;
  при работе с auth — выносить в env.
- **Неиспользуемые зависимости**: `axios` (клиент), `bcryptjs` и
  `jsonwebtoken` (сервер) установлены, но нигде не импортируются. Не
  «использовать их для простоты» без задачи — сначала решить, нужны ли.
  Аутентификации сейчас нет: идентичность = `deviceId` в localStorage.
- **`docs/` отсутствует**: `opencode.json` ссылается на папку `docs/`
  (FSD, auth, forms…), которой нет в репозитории. Не полагаться на неё;
  при создании — согласовать содержимое.
- **Архитектура не FSD**: несмотря на упоминания FSD в настройках
  инструментов, реальная структура — плоские Vue-компоненты + слоёный
  сервер. Не вводить слои entities/features/widgets задним числом без
  согласования.
- **Теги git отстают**: последний тег `v1.1.0`, а `package.json` уже
  `1.10.0`. Версию брать из `package.json`/CHANGELOG, не из тегов.
- **Дублирование данных плиток**: определения A–V живут и в
  `server/src/data/tiles.ts` (авторитетные), и в `src/data/tiles.ts`
  (зеркало клиента). При изменении — обновлять оба файла.
- **CI собирает только клиент**; сервер деплоится вручную (Render).
- Историческая заметка: в репозитории уже чистился утекший API-ключ
  opencode (`git filter-repo`, релиз 1.4.0) — не повторять ошибку
  коммита секретов.

## Полезные точки расширения

- Новое сокет-событие: тип в `src/types/socket.ts` → метод в
  `src/modules/GameService.ts` → обработчик в `server/src/socket/handlers/`
  (и регистрация в `router.ts`) → тест в `tests/integration/`.
- Новая плейсхолдер-логика на доске: `GameManager` + при необходимости
  `GameSimulatorModule` (чтобы ИИ умел этим пользоваться) + тесты.
- Правила/примеры для панели «Правила игры»: `src/rules/`
  (`baseGame.ts`, `examples.ts`, типы).
