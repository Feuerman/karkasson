# План оптимизации серверного слоя

Рабочий документ. Описывает состояние серверного слоя, найденное дублирование,
горячие места по производительности и последовательность доработок.

План меняет внутреннее устройство сервера: правила, очки, порядок ходов и
порядок сохранения игровых правил не меняются. Изменения протокола и формата
сохранения — в разделах 2.2 и 2.3, они идут отдельными этапами.

Документ внутренний, для игроков не предназначен, поэтому в `CHANGELOG.md`
попадают только сами продуктовые изменения — кратко и без внутренних деталей.

## 0. Статус

Все четыре этапа выполнены.

| Этап | Что сделано                                                                                                                                     |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| A    | Мёртвый код убран, поворот тайла и запас подданных сведены к одному месту, помощники и состояние доски описаны явно                             |
| B    | Запас подданных, описание доски, протокол изменения партии и файлы модулей разложены по назначению; новые модули покрыты unit-тестами           |
| C    | Запись состояния больше не проверяет его дважды, откат хода снимает только изменяемую часть состояния, выдача тайла считает требования клеток   |
| D    | Предпросмотр стал транзиентным, клиент получает размер колоды, флаг финального подсчёта хранится один раз, класс парции — единственный контракт |

Проверки: `pnpm test`, `pnpm run test:coverage`, `pnpm run test:gameplay`,
`pnpm run type-check`, `pnpm run lint`, `pnpm --filter server run build`.
Эквивалентность нового правила допустимости размещения сверена со старым на
случайных досках без дополнений и с рекой.

## 1. Как серверный слой устроен сейчас

46 файлов, ~9 000 строк в `server/src`.

| Модуль                             | Строк | Роль                                                      |
| ---------------------------------- | ----- | --------------------------------------------------------- |
| `modules/GameManager.ts`           | 993   | состояние партии + пять интерфейсов + делегаты помощникам |
| `services/GameService.ts`          | 719   | реестр + лобби + персистентность + формат для клиента     |
| `modules/gameSave.ts`              | 569   | валидация, миграция, сериализация и десериализация        |
| `modules/FollowerManager.ts`       | 551   | фишки: места, отзыв аббата                                |
| `modules/DragonPrincessManager.ts` | 494   | дракон и принцесса                                        |
| `modules/GameObjectManager.ts`     | 484   | объекты доски: слияние, завершение, возврат фишек         |
| `modules/GameTileManager.ts`       | 431   | колода, выдача тайла, правила реки                        |
| `modules/GameSimulatorModule.ts`   | 413   | перебор ходов ИИ                                          |
| `modules/scoring.ts`               | 400   | чистый подсчёт очков                                      |
| `socket/handlers/**`               | ~700  | транспорт: проверка формы команды, права, ack             |

Слои разделены правильно: домен (`modules/`) → сервисы (`services/`) →
транспорт (`socket/`). `server/AGENTS.md` соблюдается, правила и очки
принадлежат серверу, клиент только отображает состояние.

Основные проблемы не в архитектуре, а в трёх местах:

- логика повторяется в нескольких модулях (поворот тайла, запас подданных,
  освобождение слота, восстановление состояния, протокол изменения партии);
- четыре горячих места по производительности, из них два — на каждом ходу;
- формат состояния раздаёт клиенту лишнее, а сохранение делает лишнюю работу.

## 2. Принятые решения

### 2.1. Поворот тайла и выбор клетки не сохраняются

Предпросмотр размещения (`currentTile.rotation` и `placingPoint`) — временное
состояние интерфейса. Оно меняется на каждый клик и сейчас пишется в
хранилище: `UpdateCurrentTile` (`socket/handlers/game/tile.ts:95`) и
`SelectPlacingPoint` (`socket/handlers/game/tile.ts:67`) — изменяющие команды,
поэтому каждая заканчивается `await save()`.

Решение: эти две команды становятся **транзиентными** — меняют состояние в
памяти и рассылают его, но не пишут в хранилище.

- Авторитетный поворот по-прежнему применяется в момент постановки: `PlaceTile`
  присылает угол, сервер заново выводит стороны и группы из каталога
  (`GameManager.resolvePlacementTile`). Правила не меняются.
- Поворот уже установленного тайла сохраняется как часть постановки —
  `tilePlacesStats` пишется вместе с партией.
- После перезапуска сервера тайл вернётся неповёрнутым. Это не влияет на
  правила: игрок поворачивает тайл заново.
- `placingPoint` после перезапуска сбрасывается — превью сбросится, выбор
  клетки придётся сделать заново.

Механизм: в `runGameCommand` (`socket/handlers/gameCommand.ts:84`) появляется
флаг `persist: false`. Для транзиентных команд не делается и снимок состояния
(`game.clone()`): обе мутации атомарны — сначала проверка, потом одно
присваивание, поэтому частичного изменения не бывает и откат не нужен.

Правило `server/AGENTS.md` («перед подтверждением изменяющего запроса
сохраняй новое состояние») дополняется исключением для транзиентных команд.
`AGENTS.md` и `server/AGENTS.md` обновляются вместе с реализацией.

### 2.2. В широковещательном состоянии вместо колоды — её размер

`formatGameData` (`services/GameService.ts:629`) отправляет клиенту полную
колоду `tilesList` — до ~126 тайлов с описаниями и картинками. Клиент из неё
использует только длину: `src/utils/gameProgress.ts:64`
(`gameBoard.tilesList?.length`).

Решение: в `GameData` вместо `tilesList` приходит `tilesCount: number`.

- Клиентский тип `GameData` импортируется из `@server/services/GameService`,
  поэтому меняется в одном месте; правка в клиенте — одна строка.
- `tilePlacesStats` остаётся: доске нужны стороны и картинки тайлов.
- `actionsHistory` остаётся: панель истории читает её целиком.

### 2.3. `finalScoringEnabled` — одно поле

Флаг финального подсчёта хранится в двух местах: в корне состояния
(`IGameState.finalScoringEnabled`) и в правилах
(`GameRules.finalScoringEnabled`). Из-за этого в `gameSave.ts:251` пришлось
зафиксировать, что «корневое значение — источник истины».

Решение: остаётся только корневое поле, `GameRules` становится
`{ expansions: {...} }`.

- `GAME_SAVE_SCHEMA_VERSION` повышается с 6 до 7.
- Миграция с версии 6: если корневого поля нет, берётся `rules.finalScoringEnabled`;
  из правил флаг убирается.
- `GameSummary` и `GameSummaryRecord` получают явное поле
  `finalScoringEnabled`, чтобы сводка лобби не потеряла признак.
- Клиент: `src/App.vue:323` читает `rules?.finalScoringEnabled` — переключается
  на корневое поле.
- `GameManager.rules` и `GameManager.finalScoringEnabled` больше не расходятся
  по значению: остаётся одно поле.

### 2.4. `IGameBoard` — внутреннее дело `GameManager`

Экспортируемый интерфейс `IGameBoard` (`modules/GameManager.ts:127`) сегодня
служит контрактом между доменом, сервисами, транспортом и тестами. Он
описывает то же самое, что и класс `GameManager`, и требует держать в нём
синхронно список из пяти подынтерфейсов.

Решение: контрактом становится сам класс.

- `IGameCommands`, `IGameSimulationApi`, `IGamePlacementDiagnostics`,
  `IGamePlayerChoices` удаляются: подынтерфейсы нужны только внутри модуля,
  а внешние потребители работают с классом.
- `GameService`, `computerPlayer`, симулятор и хендлеры используют
  `GameManager` вместо `IGameBoard`.
- `GameData` (`services/GameService.ts:43`) перестаёт ссылаться на
  `IGameBoard['поле']` и опирается на `IGameState` из `modules/gameState.ts`:
  представление для клиента зависит от контракта состояния, а не от класса.
- Обновляются тесты, импортирующие `IGameBoard`:
  `tests/integration/clientGameService.test.ts`,
  `tests/unit/gameManagerState.test.ts`, `tests/unit/gameSimulator.test.ts`,
  `tests/unit/socketShared.test.ts`.
- `README.md:143` — упоминание `IGameBoard` заменяется на `GameManager`.

## 3. Убрать дублирование

### 3.1. Поворот тайла — один метод

Сейчас поворот реализован в четырёх местах:

- `socket/handlers/game/tile.ts:31` `setCurrentTileRotation` — вручную крутит
  `sides`, `roadGroups`, `cityGroups`, `cityShieldGroups`, `riverGroups`;
- `modules/GameSimulatorModule.ts:79` `rotateTile` — свой вариант, **не крутит
  `riverGroups`**;
- `modules/GameManager.ts:885` `rotateTile` — корректный, через
  `applyQuarterTurns`;
- `src/utils/tiles.ts:47` — клиентская копия для превью.

При этом `modules/tileRotation.ts:61` `applyQuarterTurns` делает ровно то же,
что и `setCurrentTileRotation`.

Действие: `applyQuarterTurns` — единственный поворот. `setCurrentTileRotation`
и симулятор переписываются через неё (симулятор заодно перестаёт терять
`riverGroups`). Клиентский поворот остаётся: это превью, авторитетный считает
сервер. В клиентском коде — комментарий, что поворот для правил считает сервер.

### 3.2. Запас подданных — один модуль

Запас меняется в трёх местах, и логика уже разошлась:

- `FollowerManager.consumeFollower` (`modules/FollowerManager.ts:541`) — списание;
- `GameObjectManager.returnFollowerToPool` (`modules/GameObjectManager.ts:273`)
  — возврат, без ветки аббата;
- `DragonPrincessManager.removeFollowerFromBoard`
  (`modules/DragonPrincessManager.ts:445`) — возврат и снятие с поля, ветка
  аббата есть.

Действие: новый `modules/followerPool.ts` с `takeFollower(pool, type)`,
`returnFollower(pool, type)` и `removeFollowerFromObject(state, follower)`.
Три вызова — один контракт, расхождение по аббату больше невозможно.

### 3.3. Снятие фишки с поля — одно место

`GameObjectManager.removePlacedFollower` (`modules/GameObjectManager.ts:461`)
и `DragonPrincessManager.removeFollowerFromBoard`
(`modules/DragonPrincessManager.ts:445`) обе ищут объект по `objectId` в четырёх
коллекциях и чистят `followers` и `placedFollowers`. → Переносится в общий
модуль из 3.2.

### 3.4. Освобождение слота — один метод

`GameService.releasePlayerToDevice` (`:467`), `releasePlayerSlot` (`:480`),
`clearPlayerSocket` (`:493`) — три почти идентичных `map` по игрокам.

Действие: `releasePlayer(gameId, socketId, { keepDevice })`; три прежних
смысла — параметры.

### 3.5. Восстановление состояния — один путь

`GameManager.cloneForSimulation` (`:918`), `restore` (`:936`) и `copyStateFrom`
(`:946`) делают одно и то же: `Object.assign(game, cloneGameState(pickGameState(x)))`.

Действие: одна приватная `applyState(source)` и два публичных входа.

### 3.6. Правила партии — одна константа и один тип опций

Правила по умолчанию продублированы в трёх местах: `services/GameService.ts:138`,
`modules/gameSave.ts:32` (`DEFAULT_RULES`), `modules/GameManager.ts:193`.
Набор опций расширений перекладывается руками в пяти местах: конструктор
`GameManager`, `GameService.createLobby` (`:318`), `GameService.startGame`
(`:440`), `gameSave.restoreLegacyLobby` (`:106`), `socket/handlers/lobby.ts:47`.

Действие: `DEFAULT_GAME_RULES` в `modules/types.ts`; тип `GameOptions` и
функции `rulesFromOptions` / `optionsFromRules`. Заодно снимается
четырёхкратное дублирование проверки булевых опций в `lobby.ts` — одна
проверка по таблице опций.

### 3.7. Каталог тайлов — один источник

Списки тайлов по расширениям перечислены в четырёх местах:
`GameTileManager.initializeDeck` (`:115`), `gameSave.allowedTileIds` (`:262`),
`data/tileDefinitions.findTileDefinitionById` (`:9`),
`GameManager.isExpansionTileAllowed` (`:411`).

Действие: `data/tileCatalog.ts` — единственный источник: `EXPANSION_TILE_SETS`,
`tilesForRules(rules)`, `allTileIds(rules)`, `findTileDefinition(id, rules)`.
Заодно решается 5.2 — поиск определения перестаёт быть линейным.

### 3.8. Подсчёт очков

- `calcGardenPoints` (`modules/scoring.ts:377`) — чистый алиас
  `calcMonasteryPoints`, а `countCenterObjectPoints` (`:392`) выбирает между
  ними по типу, хотя ветки идентичны. → Одна функция
  `countCenterObjectPoints(tilePlacesStats, object)`; тип остаётся только для
  названий. Тест `tests/unit/scoring.test.ts:374` — параметризовать.
- `finalizeScoring` (`modules/finalScoring.ts:62-89`) — четыре одинаковых
  цикла (дороги, города, монастыри, сады). → Таблица
  «вид объекта → коллекция → подсчёт → описание» и один цикл.
- `GameObjectManager` держит словари `LINEAR_FEATURE_COLLECTIONS` и
  `LINEAR_FEATURE_TYPES` (`:30-38`), но рядом остаются тернарники по виду
  (`:319`, `:409`, `:428`). → Словари дополняются, тернарники убираются.

### 3.9. Описания состояния доски — один набор

`FollowerState` (25 полей), `GameObjectState`, `DragonState`, `GameTileState`,
`FinalScoringState` — пять пересекающихся структурных описаний одного
состояния, объявленных в разных файлах, чтобы обойти циклический импорт с
`GameManager`.

Действие: новый `modules/boardState.ts`:

- `BoardCommands` — методы, которые нужны помощникам (`recordAction`,
  `endTurn`, `getTileFeatureGroups`, `findObjectByPoint`);
- узкие представления вида `Pick<IGameState, ...> & BoardCommands` — по одному
  на помощника.

`GameManager` реализует `IGameState` и `BoardCommands`. Циклический импорт
исчезает, пять дублирующих интерфейсов — тоже.

### 3.10. Один протокол изменения партии

- человек: `socket/handlers/gameCommand.ts:84` `runGameCommand` — мьютекс →
  снимок → мутация → сохранение → публикация → откат;
- ИИ: `services/computerPlayer.ts:242` `playComputerMove` — тот же протокол,
  написан отдельно: свой клон, свой откат, своя публикация.

Действие: общий исполнитель в `GameService` (`mutateAndSave(gameId, mutate,
publish)`), оба вызова — через него. Сейчас два места могут разойтись по
откату и по публикации; после объединения — не могут.

### 3.11. «Сохрани или откати» в лобби

Один и тот же паттерн реализован шесть раз: `socket/handlers/slots.ts:47`,
`slots.ts:84`, `socket/handlers/lobby.ts:81`, `lobby.ts:142`, `lobby.ts:180`,
`socket/handlers/connection.ts:20`.

Действие: `GameService.saveWithRollback(gameId, restore)`; два хендлера
правки слотов сливаются в один.

## 4. Декомпозиция

Правило: файл дробится, только если у него две разные причины меняться.
Ниже — четыре таких файла.

### 4.1. `modules/GameManager.ts` (993 строки) → три файла

- `modules/gameContracts.ts` — публичные контракты слоя (после 2.4 их почти не
  остаётся; если останется только `GameManager`, файл не нужен).
- `modules/tilePlacement.ts` — `resolvePlacementTile`, `isExpansionTileAllowed`,
  `isRiverTileRequiredAndMissing`, `applyRequestedRotation`
  (`GameManager.ts:389-462`). Это чистая функция от правил и каталога, её
  можно тестировать без доски.
- Сам `GameManager` — состояние и правила.

`placeTile` (`GameManager.ts:505-567`, 60 строк) разбивается на именованные
шаги: `applyResolvedTile` → `registerTilePlacement` → `applyExpansionEffects` →
`advanceTurn`.

### 4.2. `services/GameService.ts` (719 строк) → три файла

- `services/gameView.ts` — `formatGameData` и `collectAvailableFollowerTypes`
  (`:629-681`): представление для клиента, к реестру отношения не имеет.
- `services/gameSummary.ts` — `toGameSummary` и `sortGameSummaries` (`:121-158`).
- `GameService` — реестр, лобби, очередь команд, персистентность.

### 4.3. `modules/gameSave.ts` (569 строк) → два файла

- `modules/gameSaveValidation.ts` — все `validate*` и `migrateLegacyGameState`
  (`:46-472`).
- `gameSave.ts` — envelope, версии, `serializeGameState`,
  `deserializeGameState`, `readGameSummary`.

### 4.4. `services/computerPlayer.ts` → класс вместо глобального состояния

Три `Map` в модуле (`pendingMoveTimers`, `runningMoveChains`, `reconnectTimers`,
`:113-115`) — состояние живёт в модуле, а не в сервисе: нельзя поднять два
экземпляра, нельзя изолировать в тестах.

Действие: `class ComputerMoveScheduler` с теми же методами; создаётся в
`GameService` и передаётся хендлерам через `SocketHandlerContext`. Заодно
исчезает связь `cancelAllComputerMoves` (`app.ts:90`) с модулем.

### 4.5. Симулятор — сузить зависимость

`GameSimulatorModule` зависит от доски целиком, хотя использует около восьми
членов. После 2.4 он работает с `GameManager`, а собственные снимки
(`TileSimulationSnapshot`) описываются через `IGameState`, а не через
`IGameBoard['поле']`.

## 5. Производительность

Сначала измерить, потом править: пункт 5.1 меняет алгоритм и требует
отдельной проверки эквивалентности.

### 5.1. Выдача тайла — главное горячее место

`GameTileManager.drawNextTile` (`:144-213`) для **каждого** тайла колоды
(до ~126) вызывает `checkAvailablePlacesForTile` → `getValidTileRotation`
(`:278`) → перебор **всех свободных клеток** (до ~100) × **четырёх поворотов**
→ `isValidTilePlacement`. Итого около 50 000 проверок позиции на ход, а ходов
в партии ~70.

Действие: один раз на розыгрыш посчитать для каждой свободной клетки
«сигнатуру» — какие типы сторон требуют соседи. Сейчас это пересчитывается в
`collectSideMatches` заново для каждого тайла и каждого поворота. Дальше
совместимость тайла и клетки — сравнение наборов сторон, без четырёх полных
проверок позиции.

Проверка эквивалентности: `tests/unit/placementConflicts.test.ts`,
`tests/integration/tilePlacementDiagnostics.test.ts`,
`tests/integration/riverPlacementDiagnostics.test.ts` плюс сверка списка
допустимых клеток до и после на полной партии.

### 5.2. Поиск определения тайла

`data/tileDefinitions.ts:9` — до четырёх `Array.find` по ~126 определениям.
Вызывается на каждое размещение (`GameManager.ts:394`) и ещё раз в
сокет-хендлере (`tile.ts:40`).

Действие: `Map<string, TileDefinition>` в `data/tileCatalog.ts` (3.7).

### 5.3. Поиск устройства по сокету

`GameService.getDeviceBySocketId` (`:238`) — линейный обход всех устройств.
Вызывается из `canEditLobbySlot`, `canStartLobby`, `joinFirstFreeSlot`,
`rejoinGame` и всех хендлеров подключения.

Действие: обратная карта `socketId → deviceId`, обновляемая в `registerDevice`.

### 5.4. Список свободных клеток

`GameManager.setAvailablePlacesTiles` (`:587`) — `availablePlacesTiles.some(...)`
для каждого из четырёх соседей, то есть O(4n) на размещение, а список растёт
весь матч.

Действие: `Set` ключей `${rowIndex}:${tileIndex}` рядом со списком.

### 5.5. Поиск объекта по точке

`GameManager.findObjectByPoint` (`:670`) сканирует все города, дороги,
монастыри и сады. В `setAvailablePlacesTiles` он вызывается 16 раз за
размещение (4 соседа × 4 стороны).

Действие: в `setAvailablePlacesTiles` строить локальный индекс по окрестности
3×3 (`Map` по `x,y,direction`): объекты вне окрестности не нужны. Изменение
локальное, поведение то же.

### 5.6. Сохранение дважды валидирует состояние

`serializeGameState` (`modules/gameSave.ts:474-505`) вызывает
`migrateLegacyGameState`, который проверяет все тайлы колоды, всю историю и
все объекты, а затем `JSON.stringify` — каждое сохранение стоит примерно
вдвое дороже самой записи.

Действие: разделить «валидацию входящей записи» и «нормализацию исходящей»:
для сериализации из живого состояния достаточно проверки формы без миграции.
Заодно снимается нарушение правила `server/AGENTS.md` — нормализация должна
жить только в `deserializeGameState`.

### 5.7. Полезная нагрузка широковещания

См. решение 2.2: `tilesList` → `tilesCount`. `tilePlacesStats` и
`actionsHistory` остаются.

### 5.8. Снимок для отката

`gameCommand.ts:107` делает полный `structuredClone` состояния (колода,
история, доска) перед каждой командой; с ростом матча это самая дорогая
операция в обработчике.

Действие: для отката не нужны колода и `tileHistory` — ход их не меняет.
Достаточно изменяемого подмножества и частичного восстановления. Требует
проверки на полной партии (`pnpm run test:gameplay`).

Транзиентные команды (2.1) снимка не делают вовсе — это уже снимает самую
частую операцию: клик по клетке и клик по повороту.

### 5.9. Коды комнат при загрузке сохранений

`GameService.createUniqueRoomCode` (`:587`) строит множество кодов на каждую
партию без кода — O(n²) при массовой загрузке. → Собирать множество один раз
перед циклом.

## 6. Мёртвый код и мелкие упрощения

| Место                                    | Что                                                                                                               | Действие                                            |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `server/src/utils/common.ts:7`           | `throttle` не используется на сервере                                                                             | удалить                                             |
| `server/src/modules/types.ts:90`         | `isTileId` не используется на сервере                                                                             | удалить (копия есть в клиенте)                      |
| `modules/GameManager.ts:796`             | `checkAvailablePlacesForTile` — мёртвый делегат                                                                   | удалить                                             |
| `modules/types.ts:161`                   | `RotationTurns.Full` не используется                                                                              | удалить                                             |
| `app.ts:107`                             | `createGameEventsPublisher(io)` вызывается второй раз (первый — `router.ts:10`)                                   | переиспользовать инстанс                            |
| `modules/GameManager.ts:238-256`         | `private get objectManager/followerManager/tileManager/dragonManager` создают новый экземпляр на каждое обращение | ленивые кэшируемые поля                             |
| `modules/GameManager.ts:359,347`         | игрок ищется то по `id`, то по индексу                                                                            | один `indexOfPlayer(id)` и `playerAt(index)`        |
| `socket/handlers/game/follower.ts:48-74` | четыре проверки допустимости типа фишки дублируют `FollowerManager.allowedFollowerTypes`                          | оставить проверку домена, убрать дубли в транспорте |

## 7. Этапы

**Этап A — безопасная чистка.** Поведение не меняется.

- 6 (таблица), 3.1, 3.4, 3.5, 3.6 (только константа и тип опций), 3.8,
  4.4, 5.2, 5.3, 5.4, 5.5, 5.9.

**Этап B — структура.**

- 3.2, 3.3, 3.7, 3.9, 3.10, 3.11, 4.1, 4.2, 4.3, 4.5.

**Этап C — производительность.**

- 5.6 → 5.8 → 5.1 (отдельно, с проверкой эквивалентности).

**Этап D — решения, меняющие протокол и сохранения.** Каждый пункт — отдельный
релиз с записью в `CHANGELOG.md` и bump версии.

- 2.1 — транзиентные команды (обновление `AGENTS.md` и `server/AGENTS.md`).
- 2.2 — `tilesCount` вместо `tilesList` (клиент, типы, интеграционный тест).
- 2.3 — одно поле `finalScoringEnabled` + миграция схемы 6 → 7.
- 2.4 — `IGameBoard` становится внутренним (тесты, `README.md`).

## 8. Проверки

После каждого этапа:

- `pnpm test` — полный набор (unit + integration);
- `pnpm --filter server run build` — компиляция сервера;
- `pnpm run type-check` — клиентские типы (затрагиваются 2.2 и 2.3);
- `pnpm run lint`.

Дополнительно:

- `pnpm run test:coverage` — пороги не должны падать. Для новых модулей
  (`followerPool`, `boardState`, `tileCatalog`, `gameView`, `gameSummary`,
  `gameSaveValidation`, `ComputerMoveScheduler`) пороги появятся сами, поэтому
  их нужно сразу покрыть unit-тестами;
- `pnpm run test:gameplay` — регрессия двух полных партий после 5.1, 5.6, 5.8;
- `pnpm run test:browser` — после 2.2 (формат состояния) и 2.1 (поведение
  поворота и выбора клетки);
- `pnpm exec prettier --write AGENTS.md server/AGENTS.md docs/server-optimization-plan.md`
  — после правок инструкций и этого документа.

## 9. Риски

| Риск                                                   | Где                          | Как снимаем                                                                                                             |
| ------------------------------------------------------ | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Изменение алгоритма проверки позиции ломает размещения | 5.1                          | сверка списка допустимых клеток до и после на полной партии, отдельный этап                                             |
| Новая миграция схемы ломает чтение старых сохранений   | 2.3                          | `tests/integration/persistence.test.ts` — round-trip и перезапуск; тест на записи версии 6                              |
| Смена формата состояния ломает клиент                  | 2.2                          | тип клиента берётся из серверного модуля, правка в клиенте — одна строка; `tests/integration/clientGameService.test.ts` |
| Транзиентные команды теряют состояние при рестарте     | 2.1                          | состояние предпросмотра не влияет на правила; поворот пересчитывается при постановке                                    |
| Объединение протокола изменения ломает откат           | 3.10                         | общий исполнитель проверяется существующими интеграционными тестами очереди и отката                                    |
| Порог покрытия падает из-за новых модулей              | 3.2, 3.7, 3.9, 4.2, 4.3, 4.4 | unit-тесты на новые модули в том же этапе                                                                               |
