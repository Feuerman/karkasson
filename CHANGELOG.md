# Changelog

Все значимые изменения проекта фиксируются в этом файле.

Формат основан на [Keep a Changelog](https://keepachangelog.com/ru/1.1.0/),
версии соответствуют [Semantic Versioning](https://semver.org/lang/ru/).

## [Unreleased]

### Fixed

- **`server/src/socket/handlers/lobby.ts`** - событие `gameCreated` теперь
  отправляет `GameData`, а не внутренний объект `GameManager`.
- **Обработчики `lobby` и `game`** - игровые данные в ack-ответах теперь
  форматируются через `formatGameData`, как в контракте клиента.
- **`src/modules/GameService.ts`** - удалены неиспользуемый событийный
  транспорт и подписка на несуществующее `playerDisconnected`.
- **`server/src/modules/GameSimulatorModule.ts`** - исправлена симуляция хода
  ИИ с размещением фишки: повторная симуляция тайла ранее отклонялась как
  занятая клетка, поэтому боты пропускали все выставления фишек.
- **`server/src/modules/GameManager.ts`** - доступные позиции фишек после
  симуляции тайла вычисляются так же, как для реального хода.

### Changed

- **`src/App.vue`** - размер отображаемой сетки берётся из `gridSize`,
  присланного сервером, вместо независимого фиксированного размера 50×50.
- **`src/data/tiles.ts`** - клиент переэкспортирует серверные определения
  тайлов и `gardenTileCounts`, устраняя копию расходившихся данных.
- **`AGENTS.md`** - справочник событий Socket.IO, сетки и данных тайлов
  приведён к текущим payload и источнику истины.
- **`server/src/modules/gameSave.ts`** - добавлена версия схемы сохранений,
  runtime-валидация и поддержка миграции legacy-состояний.
- **`server/src/modules/Database.ts`** - некорректная сохранённая партия
  пропускается с диагностикой, остальные игры продолжают загружаться.

## [1.13.0] - 2026-09-23

Новый ландшафтный объект — сад. На сад ставится только аббат (не обычный
подданный); при завершении сада очки не начисляются — аббат остаётся до
отзыва владельцем и приносит по 1 очку за каждую занятую клетку в окрестности
3×3. Сад — не отдельный тайл, а признак на части копий существующих тайлов,
задаваемый конфигом при генерации колоды. Также выровнены `id` тайлов с
именами изображений и добавлены пропущенные тайлы `M` и `N`.

### Added

- **`server/src/data/tiles.ts`** - конфиг `gardenTileCounts` (по одной копии
  сада на тайлах `E`, `H`, `I`, `M`, `N`, `R`, `U`, `V`); добавлены тайлы
  `M` и `N`.
- **`server/src/modules/types.ts`** - `hasGarden` (тайл), `isGarden`
  (объект/подданный), коллекция `gardens` в `TemporaryObjects`,
  `ObjectTypes.GARDEN`, `AvailablePlacementType` `garden`.
- **`server/src/modules/scoring.ts`** - `calcGardenPoints` (подсчёт тайлов в
  окрестности 3×3 для частичного счёта аббата на саду).
- **`server/src/modules/GameManager.ts`** - `checkGardens`,
  `checkCompletedGardens`, `calcScoreForGardens`; сады учитываются в
  `findObjectByPoint`, `checkAvailableFollowers`, `placeFollower`,
  `simulatePlaceFollower` и `recallAbbot` (аббат ставится/отзывается и с сада);
  `initTilesList` помечает копии сада по `gardenTileCounts`.
- **`server/src/modules/GameSimulatorModule.ts`** - ИИ оценивает сады и ставит
  аббата на сад.
- **`server/src/socket/handlers/game.ts`** - `checkAvailablePlacements`
  возвращает сад.
- **`src/utils/labels.ts`** - подпись «Сад» и иконка для сада.
- **`src/components/GamePlacingFollowers.vue`** - кнопка «Сад — аббат» (на сад
  ставится только аббат).
- **`src/components/TileView.vue`** - маркер сада (и монастыря) в центре тайла
  и бейдж сада для условного обозначения тайлов с садом.

### Changed

- **`server/src/data/tiles.ts`** и **`src/data/tiles.ts`** - `id` тайлов
  приведены к именам изображений (`Base_Game_C3_Tile_*.png`), описания
  исправлены; `hasGarden` убран из статичных данных тайлов.
- **`server/src/modules/GameManager.ts`** - стартовый тайл теперь `D` (ранее
  `E`).
- **`src/rules/baseGame.ts`** - примеры правил обновлены под новые `id`,
  правила дополнены садом.

### Fixed

- **`server/src/modules/GameManager.ts`** - при окончании игры очищается
  `currentTile`, чтобы последний вытянутый тайл не оставался на доске.
- **`src/App.vue`** - превью тайла скрывается по окончании игры.

## [1.12.0] - 2026-09-23

Рефакторинг лобби по аналогии с `GameActionsHistory`: плоский `GameLobby.vue`
разбит на модуль с переиспользуемыми внутренними компонентами, дублирующая
разметка вынесена в общие части, игровая логика (хилперы входа/переподключения)
извлечена в чистые функции. Функциональность не менялась.

### Added

- **`src/components/GameLobby/`** - модуль лобби: `index.ts` (точка входа),
  `GameLobby.vue` (оркестратор: props/emits, состояние, вызовы `GameService`).
- **`internal/ConnectionBadge.vue`** - индикатор подключения к серверу.
- **`internal/LobbyHeader.vue`** - шапка лобби (иконка, заголовок, подзаголовок)
  с параметром размера `lg`/`md` для главного экрана и экрана готовности.
- **`internal/LoadingState.vue`** - спиннер с сообщением (заменяет три
  дублировавшихся блока «идёт соединение / загрузка списка игр»).
- **`internal/GameCard.vue`** - карточка игры в списке (статус, счёт, кнопка
  входа); эмитит `join`/`rejoin`.
- **`internal/GameStatus.vue`** - индикатор статуса игры (ход / окончена /
  ожидание игроков).
- **`internal/PlayerSlot.vue`** - слот игрока (чекбокс, поле имени, метка «ИИ»,
  кнопка «Занять/Освободить»); эмитит `toggleCheckbox`/`nameInput`/`toggleButton`.
- **`internal/helpers.ts`** - чистые функции `joinButtonIcon`, `joinButtonLabel`,
  `isRejoinable`, `canToggleSlot`.

### Changed

- **`src/App.vue`** - импорт `./components/GameLobby` (модуль) вместо
  `./components/GameLobby.vue`.

### Removed

- Плоский `src/components/GameLobby.vue` (перенесён в модуль `GameLobby/`).

## [1.11.0] - 2026-09-23

Новая особая фишка — аббат (мини-экспаншн из базовых правил): каждого
игрока есть отдельная фишка аббата, которую можно выставить вместо
обычного подданного только на монастырь. Аббата можно в свой ход снять с
монастыря (ход не расходуется) и получить по 1 очку за сам монастырь и за
каждую занятую клетку вокруг него. Завершённый монастырь с аббатом очков
не приносит и фишку не возвращает — аббат ждёт отзыва владельцем.
Финальный подсчёт незавершённых объектов не менялся.

### Added

- **`server/src/modules/scoring.ts`** - `calcMonasteryPoints(tilePlacesStats,
monastery)` - подсчёт тайлов в окрестности 3x3 для частичного счёта аббата.
- **`server/src/modules/GameManager.ts`** - метод `recallAbbot()`: отзыв аббата
  текущего игрока с начислением частичных очков и возвратом фишки в запас
  (события истории `ADDING_SCORES` + `BACK_FOLLOWER`). События истории
  `ADDING_SCORES` имеют те же `id`/`turn`/`gameId`, что и событие
  `TILE_PLACED` текущего хода.
- **`src/types/gameService.ts` / `src/modules/GameService.ts`** - событие и
  метод клиента `recallAbbot`; метод `placeFollower` принимает `followerType`.
- **`src/components/GameAbbotRecall.vue`** - панель отзыва аббата с
  предпросмотром количества очков.
- Тесты: юнит на `calcMonasteryPoints`, интеграционные сценарии постановки и
  отзыва аббата (см. `tests/`).

### Changed

- **`server/src/modules/types.ts`** - тип `ObjectFollower`/`PlacedFollower`
  получил `isAbbot?: boolean`; добавлен тип `FollowerType` (`follower`/`abbot`);
  `PlaceFollowerActionData` принимает `followerType`.
- **`server/src/modules/GameManager.ts`** - валидация в `placeFollower` и
  `simulatePlaceFollower`: аббат требует пула `monks` и объекта-монастыря,
  обычный подданный - `ordinaryFollowers`. Проверка «нечего выставлять»
  учитывает оба пула. `calcScoreForMonasteries` пропускает аббатов.
- **`server/src/modules/GameSimulatorModule.ts`** - ИИ перебирает и постановку
  аббата на монастыри, когда у игрока есть аббат в запасе.
- **`server/src/socket/handlers/game.ts`** - обработчик `recallAbbot`
  (защищён `isPlayersTurn`, проверяет наличие аббата на доске).
- **`src/components/GamePlacingFollowers.vue`** - при монастыре предлагается
  выбор «монах»/«аббат» с дизейблом по пулам.
- **`src/components/TileView.vue`** - аббат на доске отмечен крестом; обычная
  фишка - кружком в цвет игрока.
- **`src/components/GameStats.vue`** - рядом с квадратами подданных показан
  индикатор аббата (в запасе/на поле).
- **`src/components/GameActionsHistory/internal/actions/PlaceFollowerAction.vue`**
  - различает «подданный»/«аббат» и корректно подписывает объект «монастырь».
- **`src/rules/baseGame.ts`** - разделы про фишки и монастырь описывают аббата
  вместо пометки «не реализован».

### Fixed

- **`server/src/modules/GameManager.ts`** - точка-монастырь теперь помечается
  `direction: 'center'` (как и ожидает клиент): на тайле «монастырь с дорогой»
  дорога больше не перекрывает монастырь в `findObjectByPoint`, поэтому аббат
  корректно ставится на монастырь (а не отклоняется) и находится при отзыве.
- **`tests/integration/gameManagerAbbot.test.ts`** - детерминированные
  сценарии приведены в соответствие со сторонами стартового тайла `E`
  (`north = city`, `east/west = road`).
- **`server/src/modules/GameManager.ts`** - `isCorrectTilePosition` больше не
  опирается на порядок ключей `tile.sides` (клиентский `rotateSides` возвращает
  объект в порядке `{north, west, south, east}`): сопоставление сторон стало
  явным по направлению, иначе повёрнутый тайл с несимметричными
  восток/запад не находил ни одной валидной позиции. Добавлен регрессионный
  тест `tests/integration/gameManagerPlacement.test.ts`.

## [1.10.1] - 2026-09-23

Документация проекта: README переписан с шаблона Vite в полноценный обзор
(возможности, стек, архитектура, механизмы, быстрый старт, тесты, деплой),
добавлен `AGENTS.md` с инструкциями для агентов и разработчиков; в
`package.json` добавлено описание. Функциональность не менялась.

### Added

- **`AGENTS.md`** - инструкции для агентов и контрибьюторов: команды,
  архитектурные ориентиры, соглашения по коду и коммитам, тесты,
  переменные окружения, подводные камни и точки расширения.
- **`README.md`** - полное описание проекта: стек технологий, схема
  архитектуры клиент/сервер, ключевые механизмы (идентификация
  `deviceId`, сокет-транспорт, валидация ходов, подсчёт очков, ИИ,
  персистентность, доска), быстрый старт, тесты, env-переменные, деплой.

### Changed

- **`package.json`** - версия `1.10.1`, добавлено `description`.
- **`server/package.json`** - добавлено `description`.

## [1.10.0] - 2026-09-23

Рефакторинг клиента: повторяющиеся методы вынесены в утилиты, дублирующий
код из компонентов удалён, сокет-взаимодействие `GameService` сведено к
общим помощникам. Функциональность не изменилась, чище код и выше
тестируемость.

### Added

- **`src/utils/tiles.ts`** - `TILE_SIZE` (115), `normalizeRotation`,
  `rotationClass` (поворот 0/90/180/270), `rotateTile(tile, direction)` -
  возвращает новую плитку без мутаций.
- **`src/utils/board.ts`** - `findTileElement`, `scrollToTile`,
  `pulseTile` (анимация подсветки разыгрываемого объекта).
- **`src/utils/labels.ts`** - `pointTypeTitle`, `pointDirectionTitle`,
  `followerPlaceIcon` (подписи и иконки lucide для точек/подданных).
- **`src/utils/common.ts`** - `notifyError(error, fallbackMessage)`,
  `clamp`, `pluralForm`, `countBy`.
- **`src/types/game.ts`** - общий тип `LobbyGame`
  (`GameSummary & { isLastGame?: boolean }`), убран дубль из `GameLobby.vue`.
- **`src/modules/draggableRegistry.ts`** - `placeCollisionFree(id, x, y, w, h)`:
  регистрация элемента с клампом к вьюпорту и поиском свободной позиции.

### Changed

- **`src/modules/GameService.ts`** - приватные помощники `emitAck` (ack-запросы)
  и `emitAndWait` (событийные), метод `getNotConnectedError`; все сокет-методы
  (`getGamesList`, `createGame`, `addPlayer`, `removePlayer`, `joinGame`,
  `rejoinGame`, `selectPlacingPoint`, `updateCurrentTile`, `placeTile`,
  `placeFollower`, `skipFollower`, `checkAvailablePlacements`) переписаны на
  них; `emitAck` при отсутствии payload отправляет только ack-колбэк
  (схема сервера для `getGamesList`).
- **`src/components/Draggable.vue`** - логика размещения на `onMounted` и в
  `stopDrag` заменена на `placeCollisionFree`.
- **`src/App.vue`** - помощники `applyGameState`, `syncLocalTile`,
  `rotateLocalTile`, `zoomToTile`, константа `EMPTY_TILE`; уведомления об
  ошибках через `notifyError`.
- **`src/components/GameLobby.vue`** - типизация `ref<LobbyGame[]>` из общих
  типов, `addPlayer`/`removePlayer` теперь `await`-ятся, удалены мёртвые
  `try/catch` вокруг синхронных сокет-эмитов.
- **`src/components/GameActionsHistory.vue` / `TilesList.vue`** - подсчёт
  через `countBy`, прокрутка и подсветка через `src/utils/board.ts`.
- **`src/components/GamePlacingFollowers.vue` / `TileView.vue`** - словари
  и иконки вынесены в `src/utils/labels.ts` и `src/utils/tiles.ts`.

### Fixed

- **`rejoinGame`** не отклонял промис при отсутствии соединения.
- **`selectPlacingPoint` / `updateCurrentTile` / `placeTile` /
  `placeFollower` / `skipFollower` / `checkAvailablePlacements`** могли
  «зависать» при оборванном сокете (сейчас — отклонение «Нет соединения
  с сервером»).
- **Прокрутка к строке/колонке 0** - `zoomToTile` учитывал `!rowIndex` /
  `!tileIndex`, теперь проверка `=== undefined`.
- **`getGamesList`** - неверная схема ack-колбэка (сервер принимает колбэк
  первым аргументом), поймана интеграционным тестом.

### Removed

- Мёртвый код: `reactive(GameService)` и неиспользуемые `deviceId`/`playerIds`
  в обработчике `playerTemporaryDisconnected` (`App.vue`).
- Дублирующиеся локальные словари, функции пересчёта и логика размещения
  из компонентов (сеть `-200+` строк кода). Версия 1.10.0

## [1.9.0] - 2026-09-23

Средневековое оформление интерфейса в стиле «пергамент и камень»: единая
дизайн-система в `src/assets/main.css` (токены `@theme`, классы панелей и
кнопок), крупнее шрифты и контраст в разделе «Правила игры».

### Added

- **`src/assets/main.css`** — дизайн-токены в `@theme` (терракотовый
  `primary`, золото `gold`/`gold-dark`, пергамент `surface`/`parchment`,
  дерево `wood`, сукно `felt`/`board`, чернила `text`), шрифты
  Alegreya/Alegreya SC, тени `soft`/`card`/`strong`, анимации
  `fade-rise`/`shimmer`/`tile-pulse`.
- **CSS-классы**: `panel-parchment` (пергаментная панель с двойной золотой
  рамкой), `btn-stone` (деревянная кнопка с градиентом plank), `board-surface`
  (суконная подложка поля с мягким светом и сеткой), `title-medieval`
  (заголовки капителью).
- **`index.html`** — `<title>Каркассон Онлайн</title>`, `theme-color`,
  подключение Google Fonts (Alegreya + Alegreya SC).

### Changed

- **`src/components/GameLobby.vue`** — пергаментная панель лобби, деревянные
  карточки игр, рамка слотов в цвет игрока, кнопки «Занять»/«Освободить»
  единой ширины с сохранением высоты строки (`invisible` вместо условного
  рендера), выровненные кнопки подключения, крупнее шрифты.
- **`src/App.vue` / `src/components/TileView.vue`** — суконная подложка поля,
  полупрозрачные ячейки, золотая пульсация наведения, превью выкладываемого
  тайла с золотой рамкой; сукно осветлено (`#4e7357` → `#6f937a`); у тайлов
  убрана светлая окантовка по периметру — `TileView` без `bg-surface` и
  скругления, рисунок `scale-[1.08]`.
- **`GameStats.vue` / `GameActionsHistory.vue` / `GamePlacingFollowers.vue` /
  `GameMenu.vue`** — панели на пергаменте с золотой рамкой, иконки lucide,
  маркеры в цвет игрока.
- **Правила** (`RulesPanel.vue`, `RulesBlockRenderer.vue`,
  `RulesExampleGrid.vue`) — увеличены шрифты (абзацы `17px`, заголовки секций
  `1.5rem`, навигация `15px`); сводная таблица очков переведена с `UTable` на
  собственную разметку (тёмные чернила, золотая шапка, зебра-полосы, `16px`).

### Removed

- **`UTable`** из `RulesBlockRenderer.vue` (таблица очков рендерится нативной
  разметкой; бандл меньше на ~90 кБ).

## [1.8.0] - 2026-09-22

Интерфейс переведён с ручной вёрстки на компоненты Nuxt UI v4: вместо
`@tailwindcss/vite` подключён `@nuxt/ui/vite`, добавлены vue-плагин и стили
`@import '@nuxt/ui'`, а нативные `button`/`input`/спиннеры/панели/уведомления
заменены на `UButton`, `UInput`, `UCheckbox`, `UBadge`, `UCard`, `UEmpty`,
`USlideover`, `UDropdownMenu`, `UToaster`, `UAlert`, `UTable`. В главном меню
появился раздел «Правила игры» с текстовым справочником и примерами.

### Added

- **`src/rules/`** — данные правил: `types.ts` (маркеры, референсы тайлов,
  сетки примеров), `baseGame.ts` (базовые правила по секциям), `examples.ts`
  (примеры раскладок); модульные тесты `tests/unit/rulesExamples.test.ts`.
- **`src/components/rules/RulesPanel.vue`** — панель правил на `USlideover`
  (sidebar) с навигацией по секциям `UButton`; пункт «Правила игры»
  (`i-lucide-circle-help`) в меню игры.
- **`src/components/rules/RulesBlockRenderer.vue`** — рендер блоков документа:
  callout → `UAlert` (tip/warning/default с иконками lucide), таблицы → `UTable`,
  примеры → `RulesExampleGrid`.
- **`src/components/rules/RulesExampleGrid.vue`** — сетка примеров из тайлов с
  маркерами (подданные, запрет, завершение) через `UIcon`.
- **`src/components/ToastBridge.vue`** — мост уведомлений: сервис
  `notificationService` → `useToast`/`UToaster` с маппингом цветов и иконок.

### Changed

- **`vite.config.js` / `src/main.js` / `src/assets/main.css` / `index.html`** —
  `ui()` (`@nuxt/ui/vite`) вместо `tailwindcss()` (Tailwind v4 подключается
  вместе с Nuxt UI), `app.use(ui)`, `@import '@nuxt/ui'`, контейнер монтирования
  получает `class="isolate"`.
- **`package.json`** — добавлена зависимость `@nuxt/ui` `^4.11.2`, корневой
  `package.json` переведён на версию `1.8.0`.
- **`src/plugins/notification.ts`** — bridge-регистрация
  (`NotificationType`, `NotificationBridge`, `registerNotificationBridge`);
  API сервиса `success/error/warning/info` не изменился.
- **`src/App.vue`** — кнопки «Выйти из игры», «Разместить», поворота тайла",
  сброса масштаба, оверлей реконнекта и чипы игроков — `UButton`/`UIcon`/
  `UBadge`; исправлена центровка иконных кнопок поворота.
- **`src/components/GameLobby.vue`** — слоты игроков на `UCheckbox`/`UInput`/
  `UButton` с рамкой в цвет игрока, панели и карточки игр на `UCard`, пустое
  лобби на `UEmpty`, спиннер соединения на `UIcon`.
- **`src/components/GameMenu.vue`** — `UDropdownMenu` с триггером `UButton`.
- **`GameStats.vue` / `GameStatsCollapsed.vue` / `GameActionsHistory.vue` /
  `GamePlacingFollowers.vue` / `SavedGames.vue`** — панели на `UCard`, кнопки и
  инпуты на `UButton`/`UInput`; строки статистики без переносов
  (`whitespace-nowrap`).
- **Интеграционные тесты** — `helpers/frontend.ts` запускает Vite с
  `ui()`-плагином и алиасом `@server`, `vitest.integration.config.ts` добавляет
  алиасы `@`/`@server`, ассерт `<div id="app"` учитывает `class="isolate"`.

### Removed

- `src/components/notification/index.vue` (уведомления переведены на
  `UToaster`/`ToastBridge`) и `src/components/PlayersListInputCheckbox.vue`
  (заменён связкой `UCheckbox` внутри `GameLobby`).

## [1.7.0] - 2026-09-22

Проект избавлен от `any`: все оставшиеся нестрогие места типизированы, а
строковые поля сокращены до литеральных типов. Заведён единый алиас `@server/*`
для импорта серверных типов в клиент, чтобы доменная модель сервера была
единственным источником истины. Логика игры не менялась.

### Added

- **`src/types/socket.ts`** — типы ack-ответов сокета: `SocketAck<T>`,
  `GamesListResponse`, `GameResponse`, `PlacementsResponse`,
  `AvailablePlacement`, `EmptyResponse`, `GameCreatedPayload`,
  `PlayerIdsPayload`.
- **Литеральные типы**: `TileSideType` (`'field' | 'road' | 'city'`),
  `PointDirection` (`SideName | 'center'`), `PointType`, `RotationDirection`
  (`'clockwise' | 'counterclockwise'`) и `AvailablePlacementType` — в
  `server/src/modules/types.ts` и клиентском `src/modules/types.ts`.
- **`GameAction` — дискриминированный союз** по `ActionTypes` в
  `GameManager.ts`: `PlaceTileActionData`, `PlaceFollowerActionData`,
  `AddingScoresActionData`, `BackFollowerActionData` вместо
  `actionData: any`.
- **Алиас `@server/*`** в `tsconfig.json` и `vite.config.js` — клиент импортирует
  серверные типы (`@server/modules/types`, `@server/modules/GameManager`,
  `@server/services/GameService`, `@server/data/tiles`), относительные импорты
  в стиле `../../server/src/...` убраны.
- **`NotificationType`** — тип нотификации (`'success' | 'error' | 'warning' |
'info'`) вынесен из фиксированной строки в `notification/index.vue`.

### Changed

- **`src/modules/GameService.ts`** — все промисы типизированы:
  `getGamesList(): Promise<GameSummary[]>`, `createGame`/`joinGame`/
  `rejoinGame(): Promise<GameData>`, ack-вызовы — `Promise<SocketAck>`;
  `gamesList: GameSummary[]`, `onGameUpdated(callback: (game: GameData) => void)`.
- **`src/types/game.ts`** — `IGameBoard` и `IGame` выведены из серверного
  `GameData` (`isMyTurn` добавлен клиентским пересечением); `ITile` типизирован
  через `GridTile['sides']` и `ObjectFollower[]`.
- **`server/src/services/GameService.ts`** — в `GameData` добавлен
  `placingPoint`, чтобы клиентские `IGameBoard`/`IGame` совпадали с сервером.
- **`server/src/modules/GameManager.ts`** — `Object.entries(tile.sides)`
  приведён к `PointDirection`, `rotateTile` использует `RotationDirection`,
  касты `as PointDirection` вместо `direction: string`.
- **Компоненты**: `App.vue` (`playersList: Player[]`, `playerIds:
(string | number)[]`, обработка ошибок через `unknown`), `GameLobby.vue`
  (`GameSummary[]`, `Player[]`, `IGame`), `GameStats.vue`
  (`CompletedObjects`, `PlayerId`), `GamePlacingFollowers.vue`
  (`pointTypeTitle(pointType?: PointType | 'monastery')`, `pointDirectionTitle
(direction?: PointDirection)`), `GameActionsHistory.vue`
  (`highlightObject(objectData: BaseObject)`, `ObjectFollower` в reduce),
  `TileView.vue` (`canvas: HTMLCanvasElement`, `PlacedFollower[]`),
  `TilesList.vue` (`reduce<Record<string, number>>`), `Draggable.vue`,
  `SavedGames.vue`, `GameControls.vue`.
- **`src/data/tiles.ts` и `server/src/data/tiles.ts`** — массивы тайлов
  типизированы (`sides.north/east/south/west: TileSideType`, опциональные
  `isMonastery`/`withShield`/`isSolidCity`).
- **`src/utils/common.ts`** — `throttle` с обобщением
  `<T extends (...args: never[]) => void>`.
- **`env.d.ts` / `src/types/vue.d.ts`** — `DefineComponent` без `{}`/`any`,
  `src/types/components.d.ts` удалён (дублировал `env.d.ts`).
- **Хелперы тестов** — `tests/integration/helpers/client.ts` без `as any`
  (dispose закрывает менеджер транспорта), `gameplay.ts` (`SideMap`,
  `ObjectPoint.pointType?: TileSideType`).
- Корневой `package.json` переведён на версию `1.7.0`.

### Removed

- `src/components/AIPlayer.vue` (не использовался) и `src/types/components.d.ts`.

Игровое поле превращено в «карту» без нативной прокрутки: перемещение
выполняется перетаскиванием мыши (зажатая левая кнопка), колесо мыши меняет
масштаб (0.5×–3×) с фиксацией точки под курсором, в правом нижнем углу
появилась кнопка сброса масштаба. Сетка 50×50 переведена на CSS Grid с
одинаковыми отступами между клетками, изображения тайлов выровнены по центру
клетки. Превью выкладываемого тайла переработано: оно масштабируется вместе с
доской и всегда соответствует размеру клетки, перетаскивается за сам тайл
(плашка захвата убрана), кнопки поворота размещены по бокам.

### Added

- **`src/composables/useBoardPan.ts`** — composable панорамирования и зума
  доски: перетаскивание левой кнопкой мыши без полос прокрутки, зум колесом с
  привязкой к позиции курсора, сброс масштаба (`resetZoom`, якорь — центр
  видимой области), ограничение 0.5×–3×, блокировка скролла колёсиком и
  нативного drag изображений.
- **Кнопка сброса масштаба** — в правом нижнем углу экрана (⟲ 100%), видна
  только когда текущий масштаб отличается от 100% (`canReset`).

### Changed

- **`App.vue`** — доска стала bounded scroll-контейнером (`min-h-0 flex-1`,
  скрытые скроллбары), страница больше не прокручивается целиком; сетка
  переведена на CSS Grid `grid-cols-[repeat(50,115px)] gap-2.5` — одинаковые
  отступы по вертикали и горизонтали. Зум на `transform: scale()` + sizing-box
  (без полного reflow сетки), лаги при масштабировании устранены.
- **Превью выкладываемого тайла** — фиксированный размер 115px (`ghostPreviewRef`),
  масштабируется вместе с доской и всегда совпадает с текущим размером клетки;
  фрейм растёт вместе с тайлом, поэтому кнопки «Разместить» и поворота
  автоматически прилегают на любом масштабе; кнопки поворота теперь по бокам
  тайла; перетаскивание — за сам тайл (`is-none-style`), кнопкам добавлен
  `@mousedown.stop`, чтобы клики не начинали перетаскивание.
- **`TileView.vue`** — изображение заполняет контейнер (`object-cover`) с
  центровкой (`flex items-center justify-center`), canvas точек подданных
  центрирован; в сетке и превью canvas переведён на `size=115`.
- Корневой `package.json` переведён на версию `1.6.0`.

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
