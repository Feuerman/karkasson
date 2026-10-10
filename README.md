# Каркассон Онлайн

Онлайн-многопользовательская настольная игра **Carcassonne** в браузере:
клиент на Vue 3, игровой сервер на Node.js с Socket.IO и сохранением партий
в Firebase Realtime Database.

- Клиент публикуется на GitHub Pages: <https://feuerman.github.io/karkasson/>
- Игровой сервер (пример развёртывания): `https://karkasson.onrender.com`
- История изменений: [CHANGELOG.md](CHANGELOG.md) (Keep a Changelog, SemVer)

## Возможности

- **Лобби и партии** — создание игры, список активных партий, до 8 игроков
  со слотами и цветами.
- **Компьютерные соперники** — свободные слоты автоматически играют ИИ;
  после каждого хода человека сервер запускает цепочку ходов ботов.
- **Реальная сетевая игра** — все ходы ходят через Socket.IO, состояние
  валидируется на сервере, клиент получает `gameUpdated`-события.
- **Reconnect / rejoin** — игрок идентифицируется по `deviceId`
  (localStorage), при обрыве соединения может вернуться в партию и занять
  свой слот обратно.
- **Сохранение партий** — состояние игр пишется в Firebase, активные лобби
  поднимаются при старте сервера, «заброшенные» партии чистятся по таймауту.
- **История действий** — лента ходов (установка плиток, подданные, начисление
  очков) с прокруткой к объекту на доске и подсветкой; ленту можно свернуть.
- **Правила игры** — встроенная панель правил с примерами раскладок.
- **Доска** — перетаскивание, панорама и масштабирование (0.5×–3×),
  подсветка разыгрываемого объекта, поворот плитки; игровые панели можно
  переставлять в режиме настройки окон.
- **Маркеры подданных** — размещаются на соответствующем участке дороги,
  города, монастыря или сада и вращаются вместе с плиткой.
- **Средневековая тема** — оформление «пергамент и камень» на дизайн-токенах
  Tailwind CSS v4.

## Стек технологий

| Область        | Инструменты                                                       |
| -------------- | ----------------------------------------------------------------- |
| Клиент         | Vue 3, Vite, TypeScript                                           |
| UI             | Nuxt UI v4, Tailwind CSS 4                                        |
| Транспорт      | Socket.IO 4 (только WebSocket, авто-reconnect)                    |
| Сервер         | Node.js, Express 5, Socket.IO 4, TypeScript                       |
| Хранение       | Firebase Realtime Database (в тестах — in-memory реализация)      |
| Монорепо       | pnpm workspaces (`server/` — отдельный пакет workspace)           |
| Тесты          | Vitest 5 (unit + интеграционные, реальный сервер и фронтенд)      |
| Линт/формат    | ESLint 8 (vue3-recommended + typescript-eslint), Prettier 3       |
| CI/CD          | GitHub Actions → GitHub Pages (клиент)                            |

## Архитектура

Игра состоит из двух частей, связанных по WebSocket:

```
┌──────────────────────────┐        Socket.IO         ┌──────────────────────────┐
│  Клиент (Vue 3 SPA)      │ ◄──────────────────────► │  Сервер (Node.js)        │
│  src/                    │   команды и gameUpdated  │  server/src/             │
│  GameService (сокеты)    │                          │  socket/router + handlers│
│  UI-компоненты, доска    │                          │  GameService (лобби)     │
│  правила, уведомления    │                          │  GameManager (правила)   │
└──────────────────────────┘                          │  computerPlayer (ИИ)     │
                                                      └────────────┬─────────────┘
                                                                   │ IGameDatabase
                                                                   ▼
                                                      ┌──────────────────────────┐
                                                      │ Firebase Realtime DB     │
                                                      │ (в тестах — in-memory)   │
                                                      └──────────────────────────┘
```

Единый источник доменной модели — `server/src/modules/types.ts`
(`Player`, `Tile`, `GridTile`, `IGameBoard` и др.). Клиент импортирует его
через алиас `@server/*`, поэтому правила и типы не расходятся между
частями приложения.

### Структура репозитория

```
├── src/                      # Клиент (Vue 3)
│   ├── App.vue               # корневой компонент: доска, чипы игроков, оверлеи
│   ├── main.js               # точка входа: Vue + Nuxt UI
│   ├── modules/              # GameService (обёртка Socket.IO), типы, draggableRegistry
│   ├── components/           # UI: лобби, меню, статистика, история ходов, правила…
│   ├── composables/          # useBoardPan (панорама/зум доски)
│   ├── plugins/              # notification (мост к тостам Nuxt UI)
│   ├── rules/                # данные правил и примеры раскладок
│   ├── types/                # клиентские типы (game, socket, gameService)
│   ├── utils/                # tiles, board, labels, colors, followerPositions, common
│   ├── data/tiles.ts         # реэкспорт определений плиток с сервера
│   └── assets/               # main.css (токены темы), изображения плиток
├── server/                   # Игровой сервер (pnpm workspace)
│   └── src/
│       ├── index.ts          # прод-запуск: порт, загрузка партий, чистка зависших
│       ├── app.ts            # фабрика createGameServer (прод и тесты)
│       ├── config.ts         # PORT, таймауты, конфиг Firebase
│       ├── socket/           # router + обработчики: connection, lobby, game
│       ├── services/         # GameService (лобби/слоты/персистентность), computerPlayer
│       ├── modules/          # GameManager (машина состояний), scoring, types, Database
│       └── data/tiles.ts     # авторские определения 24 плиток
├── tests/                    # Vitest
│   ├── unit/                 # чистая логика (scoring, примеры правил)
│   └── integration/          # реальный сервер + клиент, helpers/
├── public/                   # статика
├── .github/workflows/        # деплой клиента на GitHub Pages
├── vite.config.js            # base /karkasson/, алиасы @ и @server
├── vitest.integration.config.ts
└── pnpm-workspace.yaml       # packages: [server]
```

## Как работают ключевые механизмы

### Идентификация и подключение

Паролей и аккаунтов нет: клиент при первом запуске генерирует
`deviceId` (`crypto.randomUUID()` в localStorage) и шлёт его на сервер
событием `registerDevice`. Сервер ведёт соответствие
`deviceId → socketId`, слоты в лобби закрепляются за `deviceId` — поэтому
после обрыва соединения игрок может сделать `rejoinGame` и вернуться в
партию. Клиент переподключается автоматически (до 10 попыток, 1–5 с),
а «тяжёлые» запросы при отсутствии соединения сразу отклоняются с
ошибкой «Нет соединения с сервером».

### Транспорт клиент ↔ сервер

Весь обмен — Socket.IO (`transports: ['websocket']`), REST не используется.
Клиентский `GameService` (`src/modules/GameService.ts`) использует
`emitAck(event, payload?)` для команд: промис резолвится ack-ответом и
реджектится при `{ error }`. События `gameUpdated`, `updateGamesList`,
`gameDeleted`, `playerTemporaryDisconnected` и `gameError` используются для
синхронизации и уведомлений, а не как подтверждение команды. `createGame`
также отправляет событие `gameCreated` с `{ gameId, game }`.

Сетка доски (`gridSize`) задаётся сервером; клиент строит отображение по
полученному размеру.

### Игровой цикл и валидация

Все правила исполняются **на сервере**. Обработчики `server/src/socket/handlers/game.ts`
проверяют `isPlayersTurn` перед каждым действием, затем вызывают
`GameManager` (`server/src/modules/GameManager.ts`) — машину состояний
`IGameBoard`:

- `placeTile(tile, row, col)` — валидирует соседство и повороты
  (`isCorrectTilePosition`, `checkAvailablePlacesForTile`);
- `getPlacementFailure(tile, row, col)` — причина отказа: несовпавшие
  стороны соседей либо отказ по правилам реки (незакрытый конец русла,
  не та сторона выхода) для подробного сообщения и подсветки;
- `placeFollower` / `skipFollower` — расчёт доступных точек для подданных
  (`checkAvailableFollowers`), размещение и возврат;
- `checkRoads` / `checkCities` / `checkMonasteries` — завершение объектов
  и начисление очков;
- `checkAvailablePlacements` — список легальных точек для текущей плитки.

Ошибки возвращаются как `{ error }` в ack или событие `error`; при
невозможном размещении тайла к `{ error }` добавляется `conflicts` —
список конфликтующих соседних клеток (для реки — сосед с открытым
руслом и причина `reason`). Клиент показывает их через `notifyError`
→ toast Nuxt UI.

### Подсчёт очков

`server/src/modules/scoring.ts`:

- дорога — количество уникальных плиток;
- город — уникальные плитки ×2 + бонусы за гербы;
- монастырь — очки, когда вокруг 9 плиток;
- `distributeScore` отдаёт очки объекта только игрокам с максимальным
  числом подданных на нём.

Очки накапливаются в `Scores` по игрокам.

### Компьютерные игроки

Игрок без `socketId` и `deviceId` считается компьютером.
`server/src/services/computerPlayer.ts` после каждого хода человека
планирует цепочку ходов ботов (`scheduleComputerMove` →
`runComputerMoves`, защита `pendingMoveTimers` от параллельных цепочек);
каждый ход выбирается через `GameManager.autoPlaceTile()` и поиск
лучшего хода в `GameSimulatorModule.findBestMove`.

### Персистентность

`server/src/modules/Database.ts` описывает интерфейс `IGameDatabase`
(`saveGame` / `getGame` / `getAllGames` / `deleteGame`). Прод-реализация —
Firebase Realtime Database (состояние сериализуется в JSON), в тестах
подменяется на `tests/integration/helpers/inMemoryDatabase.ts`. При старте
сервер поднимает сохранённые лобби, зависшие партии удаляются после
30 минут неактивности (проверка каждые 10 секунд).

### Интерфейс доски

- `useBoardPan` — перетаскивание для панорамы, колесо для зума
  (0.5×–3× с якорем под курсором), сброс масштаба;
- `draggableRegistry.placeCollisionFree` — безопасное размещение
  перетаскиваемой плитки-превью без наложений;
- `Draggable.vue` — перетаскиваемые панели с режимом настройки расположения;
- `utils/followerPositions.ts` — координаты маркеров фишек на изображениях
  тайлов с учётом стороны и поворота;
- `utils/board.ts` — `scrollToTile` / `highlightCells` для перехода к клеткам
  из истории действий: клик по координатам или по названию объекта подсвечивает
  на доске клетку или все клетки объекта;
- уведомления — `plugins/notification.ts` через мост `ToastBridge.vue`
  к `useToast()` Nuxt UI.

## Быстрый старт

Требования: [Node.js](https://nodejs.org/) 20+, [pnpm](https://pnpm.io/) 10.

```sh
# установка зависимостей (включая workspace server/)
pnpm install

# клиент (Vite dev-сервер)
pnpm run dev

# игровой сервер (отдельный терминал)
pnpm --filter server run dev
```

Клиент по умолчанию ходит на сервер по адресу из `VITE_SERVER_URL`
(иначе — `https://karkasson.onrender.com`). Локально укажите
`VITE_SERVER_URL=http://localhost:3001`.

Dev-сервер (`pnpm --filter server run dev`) автоматически использует
in-memory хранилище: игры доступны, пока сервер запущен, и не требуют
подключения к Firebase. Production-сервер продолжает сохранять игры в Firebase.

### Скрипты

| Команда                          | Назначение                                      |
| -------------------------------- | ----------------------------------------------- |
| `pnpm run dev`                   | dev-сервер клиента (Vite, HMR)                  |
| `pnpm run build`                 | проверка типов и сборка клиента в `dist/` (base `/karkasson/`) |
| `pnpm run preview`               | предпросмотр собранного клиента                 |
| `pnpm test`                      | все тесты (unit + интеграционные)               |
| `pnpm run test:gameplay`          | полные партии: 4 ИИ и человек против ИИ         |
| `pnpm run test:browser`           | браузерный smoke: создание лобби и старт игры   |
| `pnpm run type-check`            | проверка типов (`vue-tsc --noEmit`)             |
| `pnpm run lint`                  | ESLint, только проверка                         |
| `pnpm run lint:fix`              | ESLint с автоисправлением                       |
| `pnpm run format`                | Prettier по всему репозиторию                   |
| `pnpm --filter server run dev`   | сервер с nodemon (hot-reload)                   |
| `pnpm --filter server run build` | компиляция сервера в `server/dist`              |
| `pnpm --filter server run start` | запуск собранного сервера                       |

## Тесты

Vitest (конфиг — `vitest.integration.config.ts`): окружение node,
таймауты 30 с / 60 с, файлы выполняются последовательно
(`fileParallelism: false`), `COMPUTER_MOVE_DELAY_MS=100` для скорости ИИ.

- `tests/unit/` — детерминированная логика (подсчёт очков, примеры правил,
  позиции маркеров и цвета игроков для canvas);
- `tests/integration/` — реальный сервер и Vite-клиент: лобби, ходы, фишки,
  очки, reconnect, персистентность, полная партия из четырёх ИИ и полная
  партия человека с компьютерными игроками.

```sh
pnpm test
```

Для отдельного прогона двух полных партий используй
`pnpm run test:gameplay`. Эта команда дополняет, но не заменяет полный
`pnpm test`. Общие требования к регрессионному покрытию и проверкам описаны в
[`AGENTS.md`](AGENTS.md) и инструкциях соответствующего слоя.

Браузерный smoke запускает Chromium через Playwright и проверяет путь от
создания лобби до появления игровой доски. Один раз установи браузер командой
`pnpm exec playwright install chromium`.

## Переменные окружения

| Переменная               | Где      | По умолчанию                        |
| ------------------------ | -------- | ----------------------------------- |
| `VITE_SERVER_URL`        | клиент   | `https://karkasson.onrender.com`    |
| `PORT`                   | сервер   | `3001`                              |
| `COMPUTER_MOVE_DELAY_MS` | сервер   | `1000`                              |
| `SOCKET_ADMIN_UI_USERNAME` | сервер | не задано — Admin UI выключена      |
| `SOCKET_ADMIN_UI_PASSWORD_HASH` | сервер | не задано — Admin UI выключена |
| `SOCKET_ADMIN_UI_READONLY` | сервер | `true`                              |
| `FIREBASE_API_KEY`       | сервер   | обязательно для production          |
| `FIREBASE_DATABASE_URL`  | сервер   | обязательно для production          |
| `FIREBASE_AUTH_DOMAIN`   | сервер   | не задано                           |
| `FIREBASE_PROJECT_ID`    | сервер   | не задано                           |
| `FIREBASE_STORAGE_BUCKET` | сервер  | не задано                           |
| `FIREBASE_MESSAGING_SENDER_ID` | сервер | не задано                        |
| `FIREBASE_APP_ID`        | сервер   | не задано                           |
| `FIREBASE_MEASUREMENT_ID` | сервер  | не задано                           |

Для подключения к [Socket.IO Admin UI](https://admin.socket.io/) задайте обе
переменные `SOCKET_ADMIN_UI_USERNAME` и `SOCKET_ADMIN_UI_PASSWORD_HASH`.
Пароль должен быть bcrypt-хешем (например, созданным через `bcryptjs`); при
отсутствии любой из переменных админка не запускается. По умолчанию включён
режим только для чтения. Операции управления сокетами можно явно разрешить,
задав `SOCKET_ADMIN_UI_READONLY=false`.

### Firebase

Firebase нужен только production-серверу: он сохраняет партии в Realtime
Database. В разработке и тестах `NODE_ENV` не равен `production`, поэтому сервер
работает с in-memory хранилищем и подключение к Firebase не требуется.

Конфигурация Firebase не хранится в коде, а читается из переменных окружения
при старте сервера. Обязательны `FIREBASE_API_KEY` и `FIREBASE_DATABASE_URL`,
остальные `FIREBASE_*` необязательны; незаданные значения в конфиг не попадают.
Если обязательной переменной нет, сервер завершает запуск с понятной ошибкой
`Missing required environment variable ...`.

- Шаблон набора переменных — `server/.env.example`; сам `server/.env`
  игнорируется Git.
- Локальный запуск с заполненным `server/.env` (Node.js 20+):

  ```sh
  node --env-file=server/.env server/dist/index.js
  ```

- В production переменные задаются в панели хостинга (например, Render →
  Environment Variables), файл `.env` там не нужен.

Значения из этого набора — публичный веб-конфиг Firebase, он по задуманию
известен клиентам. Доступ к данным защищают правила Firebase Security Rules и
ограничения API-ключа в Google Cloud Console, а не сокрытие конфигурации.

## Деплой

- **Клиент** — GitHub Actions (`.github/workflows/deploy-gh-pages.yml`):
  при пуше в `main` запускаются проверка типов, тесты, сборка сервера, линт и
  production-сборка клиента. `pnpm run build` также обязательно запускает
  проверку типов перед Vite; артефакт `dist/` публикуется на GitHub Pages.
- **Сервер** — отдельно (пример: Render), в этом репозитории CI-задачи для
  него нет.

## Стандарты кода

- TypeScript в строгом режиме, без `any` в новом коде;
- Prettier: без точек с запятой, одинарные кавычки, отступ 2,
  `printWidth: 80` (`.prettierrc.json`);
- ESLint: `eslint:recommended` + `plugin:vue/vue3-recommended` +
  typescript-eslint + Prettier;
- алиасы: `@/*` → `src/*`, `@server/*` → `server/src/*`.

Подробнее для инструментов и контрибьюторов — см. [AGENTS.md](AGENTS.md).

## Лицензия

См. `server/package.json` (по умолчанию ISC для серверного пакета);
корневой пакет помечен как `private`.
