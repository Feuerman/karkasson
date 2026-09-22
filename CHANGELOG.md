# Changelog

Все значимые изменения проекта фиксируются в этом файле.

Формат основан на [Keep a Changelog](https://keepachangelog.com/ru/1.1.0/),
версии соответствуют [Semantic Versioning](https://semver.org/lang/ru/).

## [1.5.0] - 2026-09-22

Клиент переведён с самописных CSS-стилей на Tailwind CSS v4: подключён плагин
`@tailwindcss/vite`, тема вынесена в `@theme`, из всех Vue-компонентов удалены
блоки `<style>` и классы переписаны на утилиты Tailwind. Попутно доработаны
стили лобби: выравнивание слотов игроков, единообразные нижние кнопки, серая
подсветка пустых инпутов, игроки в списке игр выводятся по одному на строку.

### Added

- **Tailwind CSS v4** — зависимости `tailwindcss` и `@tailwindcss/vite`,
  плагин подключён в `vite.config.js` (`tailwindcss()`); точка входа —
  `src/assets/main.css` (`@import 'tailwindcss'`).
- **Тема** (`@theme` в `src/assets/main.css`): фирменные и нейтральные цвета
  (primary/success/danger/warning, поверхности, границы, текст), восемь
  динамических цветов игроков `--color-player-*` (соответствуют `PlayerColors`
  сервера), `--font-sans`, тени `soft/card/strong`, анимация `tile-pulse`, а
  также утилиты `tile-pulse` (подсветка активного тайла) и `btn-stone`.
- **`src/utils/colors.ts`** — маппер цвета игрока в классы Tailwind
  (`text-player-*` / `bg-player-*` / `border-player-*`); при отсутствии цвета
  возвращаются нейтральные серые классы.

### Changed

- Все Vue-компоненты (`App.vue`, `GameLobby`, `GameActionsHistory`,
  `GameStats`/`GameStatsCollapsed`, `TileView`, `Draggable`,
  `GamePlacingFollowers`, `PlayersListInputCheckbox`, `notification`,
  `GameControls`, `TilesList`, `AIPlayer`) переведены на утилиты Tailwind,
  блоки `<style lang="scss">` удалены; `src/assets/base.css` удалён.
- Подсветка активного тайла: класс `--active` заменён утилитой `tile-pulse`,
  выделение тайлов доски/истории — через data-атрибуты
  `data-row-index`/`data-tile-index`.
- Лобби: кнопки слотов игроков выровнены по высоте инпутов, нижние кнопки
  («Отключиться» / «Начать игру») оформлены единообразно (равная ширина,
  скругление, тень, hover-подъём), пустые инпуты игроков стали серыми вместо
  коралловых (нейтральный fallback в `colors.ts`), игроки в списке игр
  выводятся по одному на строку.
- Корневой `package.json` переведён на версию `1.5.0`.

### Removed

- Все блоки `<style>` из SFC и файл `src/assets/base.css`; единственная
  оставшаяся привязка `:style` — пиксельные координаты перетаскивания тайла
  в `Draggable.vue`.

## [1.4.0] - 2026-09-22

Переход клиента и сервера с npm на pnpm. Корневой пакет и `server` объединены
в pnpm-workspace с единым `pnpm-lock.yaml`, `node_modules` стал изолированным
(pnpm store + симлинки), а build-скрипты чувствительных зависимостей
(`@firebase/util`, `@parcel/watcher`, `protobufjs`, `vue-demi`) по умолчанию
заблокированы pnpm — снижен риск исполнения постороннего кода при установке.
Параллельно проведена чистка секретов: учётные данные opencode убраны из
репозитория, скомпрометированный ключ API вычищен из истории коммитов.
Логика игры не менялась.

### Added

- **pnpm-workspace** (`pnpm-workspace.yaml`): пакет `server` стал частью
  workspace, клиент и сервер устанавливаются одной командой `pnpm install`;
  `package-lock.json` заменён единым `pnpm-lock.yaml`, изолированные
  `node_modules` больше не имеют плоского hoisting-а.
- **Сборка сервера из workspace** — `pnpm --filter server run build`
  (`server/package.json` переведён на dev-скрипты pnpm).

### Changed

- **`.github/workflows/deploy-gh-pages.yml`** — CI переведён с npm на pnpm:
  `pnpm/action-setup`, `cache: pnpm`, `pnpm install --frozen-lockfile`.
- **`README.md`** — команды `npm install/dev/build` заменены на pnpm, добавлен
  запуск сервера (`pnpm --filter server run dev`).
- Корневой `package.json` переведён на версию `1.4.0`.

### Security

- **`opencode.json`** — из репозитория убраны учётные данные и локальные пути:
  API-ключ `ref` и путь к `codebase-memory-mcp` перенесены в глобальный конфиг
  `~/.config/opencode/opencode.jsonc` с подстановкой `{env:REF_API_KEY}`; в
  проекте остались только переносимые настройки (модель, `references`,
  `provider`).
- **История git** — ранее закоммиченный ключ API и локальные пути пользователя
  вычищены из всех коммитов (`git filter-repo` + force-push на `origin/main`).

## [1.3.0] - 2026-09-22

Клиентский `GameService` стал тестируемым: инъекция адреса сервера и
`deviceId`, класс `GameService` экспортируется, модульные тесты подсчёта
очков переведены на чистую игровую логику. Добавлены интеграционные тесты
игровых действий (валидация хода, вращения, выход из игры в запущенной
партии), полной партии против четырёх ИИ и клиентского `GameService`.

### Added

- **Модульные тесты подсчёта очков** (`tests/unit/scoring.test.ts`) на
  чистую игровую логику — детерминированный сценарий против
  `tests/integration/scoring.test.ts` с полным перебором.
- **`tests/integration/gameActions.test.ts`** — `placeTile` с неверной
  позицией и вращениями, занятое место, смена хода; `leaveGame` в
  запущенной партии (события фильтруются по `gameIsStarted`).
- **`tests/integration/computerOnly.test.ts`** — полная партия против
  четырёх ИИ без реальных игроков: ровно 67 тайлов размещено, игра
  завершается, победитель объявлен.
- **`tests/integration/clientGameService.test.ts`** — клиентский
  `GameService` против живого сервера: вход, список игр, размещение тайла,
  отключение/переподключение сокета.
- **`tests/integration/persistence.test.ts`** — расширен: перезапуск сервера
  в середине партии и её продолжение с сохранённым состоянием.
- Хелперы: `setUpPolyfills` (`tests/integration/setup.ts`, `localStorage` /
  `crypto` для node-окружения Vitest).

### Fixed

- **Флаки `tests/integration/scoring.test.ts`**: требование
  «Алиса вернула подданного» не гарантировалось случайной партией. Вместо
  него — детерминированное тождество учёта
  `вернувшиеся + оставшиеся на поле = количество объектов следов`, и
  инвариант в `assertFollowerInvariants`: на завершённом объекте не может
  остаться подданный. `playFullGame` больше не засчитывает возвращённые
  объекты повторно и отслеживает `aliceFollowedObjects` /
  `aliceFollowersOnBoardAtEnd`.

### Changed

- **`src/modules/GameService.ts`** — `GameServiceOptions { serverUrl?,
  deviceId? }`, экспорт класса и `DEFAULT_SERVER_URL`, импорты типов вынесены
  в `import type`.

## [1.2.0] - 2026-09-22

Фикс гонки при серии компьютерных ходов: раньше после каждого действия
человека запускалась отдельная цепочка ходов компьютера, и для одной игры
могли сработать несколько параллельных цепочек — они гонялись за один и тот
же ход и могли разместить один тайл несколько раз. Теперь для каждой игры
планируется не более одной такой цепочки (guard по `gameId`).

### Added

- **Интеграционные тесты движка** (`tests/integration/`, продолжают карту
  покрытия из 1.1.0):
  - `followers.test.ts` — размещение подданных (меплов) на только что
    поставленный тайл и проверка занятости места;
  - `gameplay.test.ts` — полный ход: выбор точки, размещение тайла, размещение
    подданного, переход хода, повторное подключение; `helpers/gameplay.ts` —
    базовый раунд (создание лобби, старт, ход реального игрока с AI);
  - `scoring.test.ts` — подсчёт очков за завершённые дороги/города и
    освобождение подданных.
- Новый тест в `lobby.test.ts`: **`leaveGame`** — уход игрока освобождает слот,
  а когда лобби пустеет, сервер удаляет игру (`gameDeleted`), обновляет список игр
  (`updateGamesList`). Раньше этот сценарий не был покрыт.
  Добавлен хелпер `createLobbyWithPlayers`.

### Fixed

- **`server/src/services/computerPlayer.ts`** — предотвращён запуск нескольких
  параллельных цепочек компьютерных ходов для одной игры (`pendingMoveTimers`):
  тайл более не может быть размещён несколько раз за один ход компьютера.

### Changed

- **`tests/integration/startGame.test.ts`** — логика создания лобби вынесена в
  общий хелпер, дублирование сокращено.

## [1.1.0] - 2026-09-22

Интеграционные тесты на Vitest. Сервер стал тестируемым: сборка сервера вынесена
в фабрику, хранилище игр абстрагировано от Firebase (in-memory замена), задержки
и адрес сервера вынесены в конфигурацию. Поведение игры не менялось.

### Added

- **Интеграционные тесты** (`tests/integration/`), запуск — `npm test` /
  `npm run test:integration` (Vitest `vitest.integration.config.ts`):
  - `lobby.test.ts` — создание лобби, список игр, занятые слоты, удаление игрока,
    переименование;
  - `startGame.test.ts` — старт игры, ход реального игрока (размещение тайла и
    подданного), переход хода, сохранение состояния;
  - `persistence.test.ts` — восстановление сохранённого лобби после перезапуска
    сервера;
  - `reconnect.test.ts` — временный разрыв и переподключение в игре и в лобби,
    удаление игры при уходе последнего игрока;
  - `serverFrontend.test.ts` — подъём реального Vite dev-сервера фронтенда и
    проверка, что он общается с тестовым игровым сервером.
- **Тестовая инфраструктура сервера**:
  - `server/src/app.ts` — фабрика `createGameServer` (HTTP + Socket.IO), которую
    используют и продакшн-бутстрап (`index.ts`), и тесты; поддержка
    in-memory-хранилища и ленивого подключения admin-UI.
  - Интерфейс `IGameDatabase` (`server/src/modules/Database.ts`) — хранилище игр
    абстрагировано; тесты подставляют `InMemoryDatabase`.
- **Конфигурация для тестов**: задержка хода компьютера и адрес сервера вынесены
  в переменные окружения (`COMPUTER_MOVE_DELAY_MS`, `VITE_SERVER_URL`).
- **Хелперы тестов** (`tests/integration/helpers/`): `TestClient` (обёртка над
  `socket.io-client`: ожидание событий с предикатом, ack-вызовы, симуляция
  разрыва/переподключения), `startTestServer`/`stopTestServer`,
  `startTestFrontend`, `createLobbyWithPlayers`.
- Добавлен `vitest` в dev-зависимости (`@types/node` обновлён до 24.x).

### Changed

- **`server/src/index.ts`** сокращён до использования `createGameServer`.
- **`server/src/modules/Database.ts`**: появился интерфейс `IGameDatabase`,
  класс `GameDatabase` реализует его.
- **`server/src/services/GameService.ts`** принимает `IGameDatabase` вместо
  конкретного `GameDatabase`.
- **`src/modules/GameService.ts`** (клиент): адрес сервера переопределяется через
  `VITE_SERVER_URL`.
- Корневой `package.json` переведён на версию `1.1.0`.

## [1.0.0] - 2026-09-21

Первый версионированный релиз. Основная работа — крупный рефакторинг серверной
части: монолитный `index.ts` и `GameManager.ts` разделены на слои
(конфиг → сервисы → socket-обработчики), введена строгая типизация и единая
доменная модель. Логика игры не менялась, поведение сохранено.

### Added

- **Конфигурация сервера** (`server/src/config.ts`): единое место для порта,
  origin admin-UI, таймаутов (удаление «зависших» игр, проверка, задержка хода
  компьютера) и конфигурации Firebase.
- **`server/src/services/GameService.ts`** — сервис игр и лобби, не зависящий от
  `socket.io`: реестр игр в памяти, карта `deviceId → socketId`, управление
  игроками (вход/выход/rejoin, временный и полный дисконнект), сохранение в БД и
  форматирование данных (`formatGameData`, `formatGamesList`, `getGameSummaries`).
- **`server/src/services/computerPlayer.ts`** — вся логика компьютерных игроков:
  `isComputerPlayer`, `scheduleComputerMove`, `maybeContinueWithComputerMove`,
  `runComputerMoves` (цепочка автоматических ходов подряд до хода человека).
- **`server/src/modules/scoring.ts`** — подсчёт очков вынесен из `GameManager`:
  `distributeScore` (делит очки между лидерами объекта), `calcRoadScore`,
  `calcCityScore` (с учётом щитов).
- **Socket-слой** (`server/src/socket/`):
  - `router.ts` — регистрация обработчиков на подключение;
  - `types.ts` — общий контекст `SocketHandlerContext` и тип `SocketCallback`;
  - `handlers/connection.ts` — подключение устройства, `disconnect`, `rejoinGame`;
  - `handlers/lobby.ts` — список игр, создание/вход/выход, игроки, старт игры;
  - `handlers/game.ts` — ходы: выбор точки, текущий тайл, размещение тайла и
    подданного, проверка доступных мест, пропуск подданного.
- **Доменная модель** (`server/src/modules/types.ts`): `PlayerId`, `SideName`,
  `ObjectFollower`, `PlacedFollower`, `TileSides`, `GridTile`, `TilePlacesStats`,
  `TemporaryObjects`, `AvailableFollowerPlace`, `AvailablePlace`, перечисления
  `ActionTypes`/`ObjectTypes`, хелперы `playerColorForIndex`/`playerNameForIndex`.
- **Версионирование**: `version` в корневом `package.json` переведён на `1.0.0`,
  добавлен этот `CHANGELOG.md`.
- Служебные конфиги инструментов разработки: `opencode.json`, `.serena/`,
  `server/.gitignore`.

### Changed

- **`server/src/index.ts`** сокращён с ~900 строк до точки входа: создание
  Express/HTTP/socket.io, `GameService`, регистрация обработчиков и периодическая
  очистка неактивных игр.
- **`server/src/modules/GameManager.ts`** приведён к единому стилю и типам:
  подсчёт очков делегирован в `scoring.ts`, добавлены `getNextPlayer`,
  `autoPlaceTile`, `clone`, `simulatePlaceTile`, `simulatePlaceFollower`;
  уточнены интерфейсы `IGameBoard`/`GameAction`.
- **`server/src/modules/Database.ts`**: убран `@ts-nocheck`, добавлены типы,
  операции Firebase корректно ожидаются через `await`, удалена лишняя
  диагностическая запись, добавлен парсер `parseGame`; конфиг Firebase вынесен в
  `config.ts`.
- **`server/src/modules/GameSimulatorModule.ts`** — типизация и чистка.
- **`server/src/utils/common.ts`** — обобщённые `deepClone` и `throttle`
  (`<T extends (...args: never[]) => void>`), отказ от `any`.
- **Клиент**: `placeFollower` типизирован через `AvailableFollowerPlace`, в
  компонентах наведён порядок атрибутов/событий (kebab-case), исправлено
  обращение `action.initiator?.name`, типы `game.ts`/`gameService.ts`/
  `components.d.ts` отформатированы.
- **`server/tsconfig.json`**: `module` переведён на `NodeNext`, включены
  `types: ["node"]`, `outDir`/`rootDir`; включена строгая типизация
  (`strict: true` без ослаблений `noImplicitAny`/`strictNullChecks`).
- Обновлены зависимости сборки: Vite 5 → 8, `@vitejs/plugin-vue` 4 → 6,
  `vite-plugin-vue-devtools` 7 → 8, `vue-tsc` 1 → 3.

### Removed

- Дублирующая логика обработки socket-событий из `index.ts` и `GameManager.ts`
  (перенесена в обработчики и сервисы).
- Хардкод конфигурации Firebase из `Database.ts` (перенесён в `config.ts`).
- Прагмы `@ts-nocheck`/`@ts-ignore` и отладочные `console.log` в слое БД.

### Fixed

- Ошибка при отсутствии сохранённых игр при загрузке из базы.
- Обращения к потенциально пустым полям (`action.initiator?.name`).
