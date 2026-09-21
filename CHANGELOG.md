# Changelog

Все значимые изменения проекта фиксируются в этом файле.

Формат основан на [Keep a Changelog](https://keepachangelog.com/ru/1.1.0/),
версии соответствуют [Semantic Versioning](https://semver.org/lang/ru/).

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
