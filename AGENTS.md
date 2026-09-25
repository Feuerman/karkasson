# AGENTS.md

Инструкции для агентов и контрибьюторов, работающих над проектом
«Каркассон Онлайн». Обзор продукта и архитектуры — в [README.md](README.md),
история изменений — в [CHANGELOG.md](CHANGELOG.md).

## Что это за проект

Онлайн-игра Carcassonne: Vue 3 SPA-клиент (`src/`) + игровой сервер
Node.js/Socket.IO (`server/`, pnpm workspace) + персистентность в Firebase
Realtime Database. Тесты — Vitest (unit и интеграционные). Монорепо на
pnpm, деплой клиента — GitHub Pages через Actions.

Ключевой принцип: **вся игровая логика живёт на сервере**. Клиент — это
«тонкий» рендерер состояния, которое сервер рассылает целиком через событие
`gameUpdated`. Доменная модель (`server/src/modules/types.ts`) — единственный
источник истины; клиент импортирует типы через алиас `@server/*`.

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

## Рабочий подход

- При работе с клиентом действуй как эксперт по фронтенд-разработке на Vue 3.
  Соблюдай ключевой принцип проекта: игровая логика и правила остаются на
  сервере, клиент отвечает за отображение и взаимодействие с пользователем.
- Для многошаговой или нетривиальной задачи сначала составь короткий план,
  затем выполняй его. Для небольшой правки план можно обозначить одним
  предложением.
- Перед реализацией изучи существующие решения и следуй принятым в проекте
  паттернам. Предпочитай переиспользовать код, а не дублировать его.
- Учитывай вероятные следующие изменения: делай решение пригодным для
  повторного использования, но не усложняй его абстракциями без конкретной
  необходимости.
- Если требования неоднозначны или противоречат архитектуре и правилам игры,
  сообщи об этом и уточни решение до реализации спорной части.
- Отвечай пользователю по-русски, кратко и по существу. Если в коде,
  затронутом при изучении или изменении задачи, заметил повторение, подозрительный
  участок или другую проблему качества, укажи на неё и объясни возможное
  последствие. Не расширяй задачу на несвязанные участки без необходимости.

## Карта кода

Развёрнутое описание модулей — основной ориентир для планирования фич и
рефакторинга. Слои перечислены от доменной логики наружу.

### Сервер (`server/src/`)

| Путь | Назначение |
| ---- | ---------- |
| `index.ts` | прод-бутстрап: `server.listen`, загрузка сохранённых партий, периодическая чистка «зависших» игр |
| `app.ts` | фабрика `createGameServer(db, opts)` — собирает Express + Socket.IO **без** прослушивания порта; используется и продом, и тестами |
| `config.ts` | `PORT`, `ADMIN_UI_ORIGIN`, credentials/config Admin UI, `GAME_INACTIVITY_TIMEOUT_MS`, `STALE_GAMES_CHECK_MS`, `COMPUTER_MOVE_DELAY_MS`, `firebaseConfig` |

#### Домен и правила (`server/src/modules/`)

- **`types.ts`** — вся доменная модель. Ключевые типы: `Player`, `Tile`,
  `GridTile` (`Tile` + `x`/`y` + `rowIndex`/`tileIndex`), `TileSides`
  (`north`/`east`/`south`/`west`), `Point`, `BaseObject`/`City`/`Road`/
  `Monastery` (сад — тоже `BaseObject` с `isGarden`), `TemporaryObjects`/
  `CompletedObjects`, `FollowerCount` (`ordinaryFollowers`/`monks`),
  `AvailableFollowerPlace`, `AvailablePlace`, `FollowerType` (`'follower' |
  'abbot'`), `AvailablePlacementType` (`'road'|'city'|'monastery'|'garden'`),
  enum `ActionTypes`/`ObjectTypes`, `PlayerColors`/`PlayerNames` + хелперы
  `playerColorForIndex`/`playerNameForIndex`.
- **`GameManager.ts`** — машина состояний игры: класс `GameManager implements
  IGameBoard` (~1440 строк, главный файл). Публичный API и жизненный цикл —
  см. раздел «Игровой цикл». Отвечает за валидацию ходов
  (`isCorrectTilePosition`), слияние/завершение объектов (`checkRoads`/
  `checkCities`/`checkMonasteries`/`checkGardens`, `mergeRoads`/`mergeCities`,
  `checkComplete*`), пулы фишек, `actionsHistory`, а также симуляцию
  (`simulatePlaceTile`/`simulatePlaceFollower`), `clone()` для ИИ и
  `GameManager.restore()` для восстановления сериализованного состояния.
- **`scoring.ts`** — чистые функции подсчёта очков: `distributeScore` (очки
  лидерам объекта), `calcRoadScore` (уникальные тайлы), `calcCityScore`
  (уникальные тайлы ×2 + щиты ×2), `calcMonasteryPoints`/`calcGardenPoints`
  (подсчёт занятых клеток 3×3 для отзыва аббата). Монастырь/сад при
  завершении дают 9 очков (захардкожено в `GameManager`).
- **`GameSimulatorModule.ts`** — эвристика ИИ: `findBestMove(tile)` перебирает
  доступные места × 4 поворота, клонирует доску и оценивает `calculateScore`
  (суммарные очки + бонусы за подданных на незавершённых объектах + бонус за
  невыставленные фишки). Возвращает `SimulationResult { score, moves }`.
- **`Database.ts`** — интерфейс `IGameDatabase` (`saveGame`/`getGame`/
  `getAllGames`/`saveAllGames`/`deleteGame`) и реализация `GameDatabase` на
  Firebase Realtime DB. **`gameSave.ts`** сериализует состояние в versioned
  JSON envelope и мигрирует legacy-сохранения. Синглтон `gameDatabase`.

#### Сервисы (`server/src/services/`)

- **`GameService.ts`** — реестр игр в памяти + лобби/жизненный цикл. НЕ знает
  про socket.io (рассылку делают обработчики). Отвечает за: карту
  `deviceId → socketId`, создание лобби (8 слотов), вход/выход игроков,
  start/rejoin, «освобождение» слотов при дисконнекте, сохранение/загрузку
  партий, форматирование (`formatGameData` → `GameData`,
  `formatGamesList`/`getGameSummaries` → `GameSummary[]`). Типы `GameData` и
  `GameSummary` — контракт с клиентом.
- **`computerPlayer.ts`** — логика ИИ и планировщик ходов: `isComputerPlayer`
  (игрок без `socketId` и `deviceId`), `scheduleComputerMove`,
  `maybeContinueWithComputerMove`, `runComputerMoves` (рекурсивная цепочка
  ходов ботов до хода человека), guard `pendingMoveTimers` (одна цепочка на
  игру).

#### Сокет-слой (`server/src/socket/`)

- **`router.ts`** — `registerSocketHandlers(io, service)`: на каждое
  подключение вешает обработчики connection/lobby/game.
- **`types.ts`** — `SocketHandlerContext { io, service, socket }` и
  `SocketCallback`.
- **`handlers/connection.ts`** — `registerDevice`, `disconnect` (различает
  временный/полный разрыв), `rejoinGame`.
- **`handlers/lobby.ts`** — `getGamesList`, `createGame`, `joinGame`,
  `addPlayer`, `removePlayer`, `startGame`, `leaveGame`.
- **`handlers/game.ts`** — игровые ходы: `selectPlacingPoint`,
  `updateCurrentTile`, `placeTile`, `placeFollower`, `recallAbbot`,
  `checkAvailablePlacements`, `skipFollower`. Каждый ход защищён проверкой
  `isPlayersTurn(game, socket.id)`.

Полный список событий — в разделе «Справочник сокет-событий».

#### Данные

- **`data/tiles.ts`** — **авторитетные** определения тайлов `A`–`X` (`count`,
  `sides`, `isMonastery`, `withShield`, `isSolidCity`, `imgUrl`) и конфиг
  `gardenTileCounts` (сады — признак на копиях тайлов, а не отдельный тайл).
  Стартовый тайл — `D`. Клиентский `src/data/tiles.ts` переэкспортирует эти
  данные и не содержит отдельную копию.

### Клиент (`src/`)

| Путь | Назначение |
| ---- | ---------- |
| `main.js` | точка входа: `createApp(App)` + Pinia + Nuxt UI (`app.use(ui)`) |
| `App.vue` | корневой оркестратор (~600 строк): держит состояние игры, встраивает лобби, доску, превью тайла, поворот, размещение, реконнект-оверлей |
| `modules/GameService.ts` | обёртка Socket.IO; класс `GameService` + default-экспорт синглтона. Команды используют ack-колбэк `emitAck`, подписки возвращают функцию отписки |
| `modules/draggableRegistry.ts` | `placeCollisionFree` — безопасное размещение перетаскиваемых элементов без наложений |
| `modules/types.ts` | **мёртвый код** (не импортируется): типы давно берутся из `@server/*` |
| `composables/useBoardPan.ts` | панорама/зум доски (перетаскивание, колесо 0.5×–3×, сброс) |
| `plugins/notification.ts` | `notificationService.success/error/warning/info` (default export), bridge на тосты Nuxt UI |
| `types/socket.ts` | типы Socket.IO ack-ответов и payload событий сервера, включая `CreateGameResponse` |
| `types/game.ts` | `IGameBoard = GameData & { isMyTurn }`, `IGame`, `LobbyGame`, `ITile` |
| `types/gameService.ts` | интерфейс `IGameService` |
| `data/tiles.ts` | **зеркало** `server/src/data/tiles.ts` |
| `rules/` | данные панели «Правила игры»: `types.ts`, `baseGame.ts`, `examples.ts` |
| `utils/` | `tiles.ts` (`TILE_SIZE`, повороты), `board.ts` (`scrollToTile`/`pulseTile`), `labels.ts` (подписи/иконки), `colors.ts` (маппер цвета в Tailwind-классы), `common.ts` (`notifyError`, `clamp`, `pluralForm`, `countBy`) |
| `assets/main.css` | дизайн-токены Tailwind v4 `@theme`, классы `panel-parchment`/`btn-stone`/`board-surface`/`title-medieval`, цвета `--color-player-*` |

#### Компоненты (`src/components/`)

- **`GameLobby/`** — модуль лобби: `GameLobby.vue` (оркестратор) +
  `internal/` (`PlayerSlot`, `GameCard`, `GameStatus`, `ConnectionBadge`,
  `LobbyHeader`, `LoadingState`, `helpers.ts` — чистые функции).
- **`GameActionsHistory/`** — лента действий: `GameActionsHistory.vue` +
  `internal/actions/` (`PlaceTileAction`, `PlaceFollowerAction`,
  `BackFollowerAction`, `AddingScoresAction`), `ActionRow`,
  `ActionCoordinates`, `PlayerName`, `players.ts`.
- **Прочее**: `GameControls.vue` (панель управления), `GameStats.vue` /
  `GameStatsCollapsed.vue`, `GamePlacingFollowers.vue` (выбор точки/типа
  фишки), `GameAbbotRecall.vue` (отзыв аббата), `TileView.vue` (рендер тайла
  и фишек на canvas), `TilesList.vue` (колода), `Draggable.vue`,
  `SavedGames.vue`, `GameMenu.vue`, `ToastBridge.vue` (мост уведомлений),
  `rules/` (`RulesPanel`, `RulesBlockRenderer`, `RulesExampleGrid`),
  `icons/` (дефолтные заглушки Vite).

## Доменная модель и система координат

- **Сетка**: сервер задаёт `gridSize = [30, 30]`; клиент строит отображение по
  полученному `game.gridSize`. Состояние тайлов — `tilePlacesStats:
  Record<rowIndex, Record<tileIndex, GridTile>>`. Соглашение: **`rowIndex` =
  строка (Y), `tileIndex` = колонка (X)**. Внутри `GridTile` дублируется
  `x = tileIndex`, `y = rowIndex`.
- **Стороны тайла** — `sides: { north, east, south, west }`, значение —
  `'field' | 'road' | 'city'`. Точка-объект (`Point`) имеет координаты
  тайла + `direction` (`'north'|'east'|'south'|'west'` или `'center'` для
  монастыря/сада).
- **Смежные точки**: `getPrecisionCoordinates` сдвигает точку на ±0.5 в
  направлении стороны — так две противоположные стороны соседних тайлов
  совпадают по «дробным» координатам (`isOppositePoint`) и объект
  (дорога/город) считается завершённым/склеенным.
- **Пулы фишек** игрока: `playersFollowers[id] = { ordinaryFollowers: 7,
  monks: 1 }` (`monks` = фишки аббата).
- **Объекты** (`temporaryObjects`/`completedObjects`) группируются по типу:
  `cities`, `roads`, `monasteries`, `gardens`. У каждого `points[]` и
  `followers[]`. Сад и монастырь — «центральные» объекты (`direction:
  'center'`), на них ставится **только аббат** (сад) / подданный или аббат
  (монастырь).
- **Поворот**: `rotation` 0/90/180/270. ВНИМАНИЕ: клиентский `rotateSides`
  возвращает объект в порядке `{north, west, south, east}` — **никогда не
  полагаться на порядок ключей** `sides` (регрессия 1.11.0), сопоставлять
  стороны явно по направлению (как в `isCorrectTilePosition`).

## Игровой цикл

Жизненный цикл одного хода (всё на сервере, в `GameManager`):

1. `startGame()` → `placeStartTile()` кладёт тайл `D` в центр → `currentPlayer
   = players[0]`.
2. `getRandomTileFromList()` вытягивает следующий тайл в `currentTile`
   (пропускает тайлы без валидной позиции через `checkAvailablePlacesForTile`).
3. `placeTile(tile, row, col)`:
   - валидация `isCorrectTilePosition` (соседство сторон);
   - запись в `tilePlacesStats`, действие `PLACE_TILE` в `actionsHistory`;
   - `setAvailablePlacesTiles` (обновляет список легальных слотов);
   - `checkGridAfterPlacingTile` → `checkRoads`/`checkCities`/
     `checkMonasteries`/`checkGardens` — склейка и завершение объектов
     (начисление очков, возврат фишек, события `ADDING_SCORES`/`BACK_FOLLOWER`);
   - `checkAvailableFollowers()`: если есть свободные объекты на тайле —
     `isPlacingFollower = true`, иначе сразу `endTurn()`.
4. `placeFollower(place, type?)` или `skipFollower()` → `endTurn()`. Аббата
   можно дополнительно отозвать (`recallAbbot`) в свой ход — ход не тратится.
5. `endTurn()` → `moveCounter++` (раз за круг), `getNextPlayer`,
   `getRandomTileFromList()` для следующего игрока.
6. Когда `tilesList` пуст — `gameIsEnded = true`, `currentTile = null`.

Клиент получает результат каждого шага через `gameUpdated` и просто
перерисовывается. `checkAvailablePlacements` — отдельный запрос «что можно
поставить на конкретную точку» (для UI подсветки).

## Справочник сокет-событий

### Клиент → сервер

| Событие | Payload | Ответ (ack / событие) | Хендлер | Guard |
| ------- | ------- | --------------------- | ------- | ----- |
| `registerDevice` | `{ deviceId }` | — | connection | — |
| `disconnect` | `reason` | — | connection | — |
| `rejoinGame` | `{ gameId, deviceId }` | ack `{ game }`, `gameUpdated` / `error` | connection | — |
| `getGamesList` | (callback первым аргументом) | ack `{ games }` | lobby | — |
| `createGame` | — | ack `{ success, gameId, game }`, событие `gameCreated { gameId, game }` | lobby | — |
| `joinGame` | `{ gameId }` | ack `{ success, game }`, `gameUpdated` | lobby | — |
| `addPlayer` | `{ gameId, name, index }` | ack `{ success, game }` | lobby | — |
| `removePlayer` | `{ gameId, index, name }` | ack `{ success, game }` | lobby | — |
| `startGame` | `{ gameId }` | ack `{ success, game }`, `gameUpdated` | lobby | — |
| `leaveGame` | `{ gameId }` | ack `{ success, game }`, `gameUpdated` / `gameDeleted` | lobby | — |
| `selectPlacingPoint` | `{ gameId, point: { rowIndex, tileIndex } }` | ack `{ success, game }` | game | `isPlayersTurn` |
| `updateCurrentTile` | `{ gameId, rotation }` | ack `{ success, game }` | game | `isPlayersTurn` |
| `placeTile` | `{ gameId, rotation, position: { rowIndex, tileIndex } }` | ack `{ success, game }` | game | `isPlayersTurn` |
| `placeFollower` | `{ gameId, place, followerType? }` | ack `{ success, game }` | game | `isPlayersTurn` |
| `recallAbbot` | `{ gameId }` | ack `{ success, game }` | game | `isPlayersTurn` |
| `checkAvailablePlacements` | `{ gameId, position: { row, col } }` | ack `{ placements }` | game | — |
| `skipFollower` | `{ gameId }` | ack `{ success, game }` | game | `isPlayersTurn` |

### Сервер → клиент

| Событие | Payload | Когда |
| ------- | ------- | ----- |
| `gameUpdated` | `GameData` | любое изменение состояния партии (комната `gameId`) |
| `gameCreated` | `{ gameId, game }` | создание лобби |
| `updateGamesList` | `GameSummary[]` | изменение списка игр (broadcast всем) |
| `gameDeleted` | — | удаление партии |
| `playerTemporaryDisconnected` | `{ deviceId?, playerIds: Player[] }` | временный разрыв игрока |
| `playerReconnected` | — | **не реализовано сервером**; не подписываться на событие |
| `error` | строка | ошибка (показывается как toast) |
| `gameError` | `{ message }` | ошибка в цепочке ходов ИИ (клиентом **не обрабатывается**) |

### Паттерны запросов

- **Ack** (`emitAck`): клиент шлёт `event(payload, callback)`, сервер отвечает
  `callback({ success, game })` или `callback({ error })`. Ошибки в
  `response.error` → reject промиса.
- `gameUpdated` и `updateGamesList` — уведомления для синхронизации состояния;
  клиентские команды подтверждаются ack-ответом и не используют эти события
  вместо подтверждения.
- Особый случай: `getGamesList` принимает **только callback без payload**
  (`emit(event, callback)`).

## ИИ (компьютерные игроки)

- Компьютер = `Player` без `socketId` и `deviceId`. Свободные слоты лобби
  занимаются автоматически.
- После каждого хода человека обработчики вызывают
  `maybeContinueWithComputerMove` → если очередь ушла к боту, планируется
  `scheduleComputerMove` (задержка `COMPUTER_MOVE_DELAY_MS`).
- `runComputerMoves` рекурсивно проигрывает ходы ботов: `autoPlaceTile`
  (`GameSimulatorModule.findBestMove`) + `placeFollower`, пока очередь не
  вернётся к человеку.
- Guard `pendingMoveTimers` (по `gameId`) не даёт запустить параллельные
  цепочки — тайл не может быть поставлен дважды.

## Архитектурные ориентиры

- **Доменная модель — в `server/src/modules/types.ts`**. Не дублировать типы
  на клиенте: импортировать через `@server/*`.
- **Правила игры — только на сервере** (`GameManager.ts` + `scoring.ts`).
- **Сокет-слой — `server/src/socket/`**; каждый ход защищён `isPlayersTurn`.
- **Сервисный слой — `server/src/services/`** (`GameService.ts`,
  `computerPlayer.ts`).
- **Транспорт клиента — `src/modules/GameService.ts`**: `emitAck` для команд;
  широковещательные события используются для синхронизации. REST/axios не используется.
- **Алиасы**: `@/*` → `src/*`, `@server/*` → `server/src/*`.
- **Персистентность — `server/src/modules/Database.ts`** (`IGameDatabase`).
  Схема и миграции — `server/src/modules/gameSave.ts`; при добавлении нового
  формата увеличивать `GAME_SAVE_SCHEMA_VERSION` и сохранять поддержку старой
  версии. В тестах — `tests/integration/helpers/inMemoryDatabase.ts`.
- **UI-кит — Nuxt UI v4** (компоненты `U*`). Токены/классы — в
  `src/assets/main.css`. Цвета игроков — `src/utils/colors.ts` + серверный
  `PlayerColors` — менять синхронно.
- **Уведомления — `src/plugins/notification.ts`**; не вызывать `useToast()`
  напрямую.

## Соглашения

- **TypeScript строго, без `any`** в новом коде (zero-`any` рефакторинг, см.
  CHANGELOG 1.7.0).
- **Небольшая ответственность**: функция, метод или компонент должны решать
  одну понятную задачу. Предпочитай самодостаточные части кода, зависимости
  передавай явно; используй DI, когда он упрощает замену или тестирование
  зависимости.
- **Осмысленные имена**: называй переменные и функции по назначению. Не
  используй неинформативные имена вроде `a`, `arr` или `tmp`, кроме коротких
  локальных счётчиков и общепринятых обозначений.
- **Булевы значения**: используй `!value` для отрицания и `!!value` для
  явного приведения к boolean. Не используй `value === true` или
  `value ?? false` только ради преобразования в boolean; не меняй при этом
  намеренно различие между `null`/`undefined` и `false`.
- **Non-null assertion запрещён**: не используй оператор `!` после значения
  (`value!`). Проверь значение явно или перестрой поток выполнения так, чтобы
  типы отражали гарантию наличия.
- **Prettier**: без точек с запятой, одинарные кавычки, отступ 2,
  `trailingComma: es5`, `printWidth: 80`.
- **ESLint**: `.eslintrc.json` (не flat config), `prettier/prettier` — ошибка.
- **Коммиты**: сообщения на **русском**, императив/описание, префикс области
  (`Server`, `Client`, `Changelog:`). Conventional commits **не используются**.
- **Версии и CHANGELOG**: SemVer в `package.json`; каждый релиз — запись в
  `CHANGELOG.md` (Keep a Changelog, Russian), обычно коммитом `Changelog: ...`.
  Значимое изменение без записи — недоделка.
- **Типы клиентских сокетов** — в `src/types/socket.ts`; при добавлении
  события обновить: клиентский метод в `GameService`, обработчик на сервере,
  тип.
- **Тесты обязательны** для логики сервера: юнит — для чистых функций
  (scoring), интеграционный — через `createGameServer` + TestClient.
- **Новые библиотеки**: сначала проверь манифесты и доступные зависимости
  проекта, затем проверь, можно ли решить задачу уже установленной библиотекой.
  Добавляй новую зависимость только если подходящего существующего решения нет.
  Для неизвестного или меняющегося API сверяйся с актуальной документацией
  через доступный инструмент поиска документации.

## Тесты

- Конфиг: `vitest.integration.config.ts` (окружение node, include
  `tests/**/*.test.ts` — unit и integration). Файлы — **последовательно**
  (`fileParallelism: false`), таймауты 30 с / hook 60 с,
  `COMPUTER_MOVE_DELAY_MS=100`.
- Helpers (`tests/integration/helpers/`): `client.ts` (TestClient),
  `server.ts` (startTestServer), `frontend.ts` (реальный Vite-фронтенд),
  `inMemoryDatabase.ts`, `lobby.ts`, `gameplay.ts`.
- Состав (`tests/`):
  - `unit/` — `scoring.test.ts`, `rulesExamples.test.ts`, `gameSave.test.ts`;
  - `integration/` — `lobby`, `startGame`, `gameplay`, `followers`,
    `scoring`, `reconnect`, `persistence`, `gameActions`, `computerOnly`,
    `clientGameService`, `serverFrontend`, `gameManagerPlacement`,
    `gameManagerAbbot`, `gameManagerGarden`.
- Запуск: `pnpm test`. Перед сдачей — весь набор зелёный.

## Переменные окружения

- `VITE_SERVER_URL` — адрес игрового сервера (прод:
  `https://karkasson.onrender.com`; локально — `http://localhost:3001`).
- `PORT` — порт сервера (по умолчанию `3001`).
- `COMPUTER_MOVE_DELAY_MS` — задержка хода ИИ (по умолчанию `1000`).

Файлов `.env` в репозитории нет (есть локальный `.env.local`, gitignored);
при добавлении — не коммитить секреты, добавить `.env.example`.

## Известные проблемы и подводные камни

- **Firebase-конфиг закоммичен** в `server/src/config.ts`. Считать несекретным
  (правила — на стороне Firebase), но **не добавлять туда ключи/токены**;
  auth — выносить в env.
- **Неиспользуемые зависимости**: `axios` (клиент), `bcryptjs`/`jsonwebtoken`
  (сервер) — не импортируются. Аутентификации нет: идентичность = `deviceId`
  в localStorage.
- **`docs/` отсутствует**: `opencode.json` ссылается на `docs/` (FSD, auth,
  forms…), которой нет. Не полагаться на неё; при создании — согласовать.
- **Архитектура не FSD**: плоские Vue-компоненты + слоёный сервер. Не вводить
  слои entities/features/widgets задним числом.
- **Теги git отстают**: последний тег `v1.1.0`, `package.json` уже `1.13.0`.
  Версию брать из `package.json`/CHANGELOG.
- **Данные плиток**: источник истины — `server/src/data/tiles.ts`; клиентский
  `src/data/tiles.ts` только переэкспортирует их.
- **Мёртвый код клиента**: `src/modules/types.ts` (не импортируется),
  `src/types/gameService.ts` (интерфейс с `placeFollower: unknown`). Не
  «чинить походя» без задачи, но при рефакторинге — удалять.
- **Порядок ключей `sides`**: клиентский `rotateSides` возвращает
  `{north, west, south, east}` — не опираться на порядок ключей.
- **CI собирает только клиент**; сервер деплоится вручную (Render).
- Историческая заметка: в репозитории чистился утекший API-ключ opencode
  (`git filter-repo`, релиз 1.4.0) — не коммитить секреты.

## Полезные точки расширения

- **Новое сокет-событие**: тип в `src/types/socket.ts` → метод в
  `src/modules/GameService.ts` → обработчик в `server/src/socket/handlers/`
  (регистрация в `router.ts`) → тест в `tests/integration/`.
- **Новая плейсхолдер-логика (новый объект на доске)**: тип в
  `types.ts` → `GameManager` (создание/склейка/завершение/подсчёт, как у
  сада) → `scoring.ts` → `GameSimulatorModule` (чтобы ИИ пользовался) →
  `handlers/game.ts` (`checkAvailablePlacements`) → клиентские подписи
  (`labels.ts`, `GamePlacingFollowers`, `TileView`) → тесты. Пример-референс —
  сад (CHANGELOG 1.13.0).
- **Новый тип фишки**: `FollowerType`, пулы `FollowerCount`, валидация в
  `placeFollower`/`simulatePlaceFollower`.
- **Правила/примеры панели**: `src/rules/` (`baseGame.ts`, `examples.ts`,
  `types`).
- **Новое правило подсчёта**: `scoring.ts` + юнит-тест + `calcScoreFor*` в
  `GameManager`.
