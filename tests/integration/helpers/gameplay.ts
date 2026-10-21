import { expect } from 'vitest'
import { TestClient } from './client'
import {
  ActionTypes,
  FollowerType,
  SideName,
  SocketEvents,
  TileSideType,
  type ExpansionName,
  type PlayerId,
  type SideName as SideNameType,
  type TileSideType as TileSideTypeType,
} from '@server/modules/types'
import { latestGame, type GameSummaryPlayer } from './lobby'

/**
 * Хелперы для интеграционных тестов «живого» игрового процесса:
 * прогрев партии против настоящего сервера, поиск легальных ходов и
 * независимый оракул базового подсчёта очков для проверки инвариантов.
 */

// ------------------------------------------------------------------ типы

export type SideMap = Record<SideNameType, TileSideTypeType>

export const SIDE_ORDER: SideNameType[] = [
  SideName.North,
  SideName.East,
  SideName.South,
  SideName.West,
]

export interface TileSnapshot {
  id: string
  rotation: number
  sides: SideMap
  x?: number
  y?: number
  rowIndex?: number
  tileIndex?: number
  withShield?: boolean
  isMonastery?: boolean
  hasGarden?: boolean
  hasInn?: boolean
  hasCathedral?: boolean
  expansion?: ExpansionName
  imgUrl?: string
}

export interface ObjectPoint {
  x: number
  y: number
  direction?: string
  pointType?: TileSideTypeType
  rowIndex?: number
  tileIndex?: number
}

export interface ObjectFollowerSnapshot {
  playerId: number | string
  objectId: string
  point: ObjectPoint
  isAbbot?: boolean
  isBigFollower?: boolean
}

export interface ObjectScoreSnapshot {
  objectId?: string
  total: number
  players: Record<string, number>
}

export interface BaseObjectSnapshot {
  id: string
  points: ObjectPoint[]
  followers: ObjectFollowerSnapshot[]
  isMonastery?: boolean
  isGarden?: boolean
  hasInn?: boolean
  hasCathedral?: boolean
  expansion?: 'innsAndCathedrals'
  score?: ObjectScoreSnapshot
}

export interface CompletedObjectsSnapshot {
  cities: BaseObjectSnapshot[]
  roads: BaseObjectSnapshot[]
  monasteries: BaseObjectSnapshot[]
  gardens: BaseObjectSnapshot[]
}

export interface FollowerPlaceSnapshot {
  point: ObjectPoint
  temporaryObject: BaseObjectSnapshot
}

export interface PlacedFollowerSnapshot {
  playerId: number | string
  objectId: string
  point: ObjectPoint
  isMonastery?: boolean
  isGarden?: boolean
  isAbbot?: boolean
}

export interface FollowerCountSnapshot {
  ordinaryFollowers: number
  bigFollowers?: number
  monks: number
}

/** Полный срез игры в том виде, в каком его присылает сервер */
export interface GameStateSnapshot {
  id: string
  gridSize?: number[]
  players: GameSummaryPlayer[]
  currentPlayerIndex: number
  currentPlayer?: GameSummaryPlayer | null
  gameIsStarted: boolean
  gameIsEnded: boolean
  moveCounter: number
  scores: Record<string, number>
  winnerPlayerIds?: Array<PlayerId>
  finalScoringEnabled?: boolean
  tilesCount: number
  currentTile?: TileSnapshot | null
  tilePlacesStats: Record<number, Record<number, TileSnapshot>>
  availablePlacesTiles?: Array<{ rowIndex: number; tileIndex: number }>
  availableFollowersPlaces?: FollowerPlaceSnapshot[]
  /** Допустимые типы фишек по id объекта: интерфейс рисует по ним кнопки. */
  availableFollowerTypes?: Record<string, string[]>
  /** Что даст отзыв аббата текущему игроку. */
  abbotRecall?: {
    objectId: string
    objectType: string
    points: number
  } | null
  isPlacingFollower?: boolean
  playersFollowers?: Record<string, FollowerCountSnapshot>
  placedFollowers?: PlacedFollowerSnapshot[]
  temporaryObjects?: {
    cities: BaseObjectSnapshot[]
    roads: BaseObjectSnapshot[]
    monasteries: BaseObjectSnapshot[]
    gardens: BaseObjectSnapshot[]
  }
  completedObjects?: CompletedObjectsSnapshot
  placingPoint?: { rowIndex: number; tileIndex: number }
  actionsHistory?: Array<{
    actionType: ActionTypes
    initiator?: { socketId?: string | null; deviceId?: string | null } | null
    moveNumber?: number
    actionData?: {
      objectType?: string
      score?: { total: number; players: Record<string, number> }
      details?: Array<{
        label: string
        count: number
        pointsPerUnit: number
        total: number
      }>
      modifiers?: string[]
      isFinalScoring?: boolean
    }
  }>
}

export interface ValidMove {
  tile: TileSnapshot
  rowIndex: number
  tileIndex: number
}

/** Ответ игровой команды: сервер подтверждает ход и присылает состояние. */
export interface GameAck {
  success: boolean
  game: GameStateSnapshot
}

interface StatsLike {
  tilePlacesStats: GameStateSnapshot['tilePlacesStats']
}

/**
 * Минимальный срез состояния, которого достаточно для подбора размещения:
 * тесты передают сюда и снимок gameUpdated, и GameData клиентского сервиса.
 */
export type PlacementState = Pick<
  GameStateSnapshot,
  'currentTile' | 'availablePlacesTiles' | 'tilePlacesStats'
>

export const playerId = (value: number | string): string => String(value)

// ------------------------------------------------------- поиск легального хода

/**
 * Поворот сторон по часовой стрелке (как rotateTile на сервере).
 * Важно сохранить порядок ключей [north, east, south, west]: сервер
 * сопоставляет соседей по Object.keys(tile.sides), поэтому перезаписываем
 * значения через spread, не меняя порядок ключей.
 */
export function rotateSides(sides: SideMap, count: number): SideMap {
  let current = { ...sides }
  for (let i = 0; i < count; i++) {
    current = {
      ...current,
      [SideName.North]: current[SideName.West],
      [SideName.East]: current[SideName.North],
      [SideName.South]: current[SideName.East],
      [SideName.West]: current[SideName.South],
    }
  }
  return current
}

function sidesOfTile(
  stats: GameStateSnapshot['tilePlacesStats'],
  rowIndex: number,
  tileIndex: number
): SideMap | undefined {
  return stats[rowIndex]?.[tileIndex]?.sides
}

/** Зеркало серверной isCorrectTilePosition */
export function isValidPosition(
  state: StatsLike,
  sides: SideMap,
  rowIndex: number,
  tileIndex: number
): boolean {
  const stats = state.tilePlacesStats
  const adjacent = [
    sidesOfTile(stats, rowIndex - 1, tileIndex)?.south,
    sidesOfTile(stats, rowIndex, tileIndex + 1)?.west,
    sidesOfTile(stats, rowIndex + 1, tileIndex)?.north,
    sidesOfTile(stats, rowIndex, tileIndex - 1)?.east,
  ]

  if (!adjacent.some(Boolean)) return false

  return adjacent.every(
    (type, index) => !type || type === sides[SIDE_ORDER[index]]
  )
}

/** Подбирает легальное место и поворот для текущего тайла игрока */
export function findValidPlacement(state: PlacementState): ValidMove | null {
  const tile = state.currentTile ?? null
  if (!tile?.sides) return null

  const places = state.availablePlacesTiles ?? []
  for (const place of places) {
    for (let rotation = 0; rotation < 4; rotation++) {
      const sides = rotateSides(tile.sides, rotation)
      if (isValidPosition(state, sides, place.rowIndex, place.tileIndex)) {
        return {
          tile: { ...tile, sides, rotation: rotation * 90 },
          rowIndex: place.rowIndex,
          tileIndex: place.tileIndex,
        }
      }
    }
  }
  return null
}

/** Как findValidPlacement, но падает: тесту без легального хода нечего проверять. */
export function requireValidPlacement(state: PlacementState): ValidMove {
  const move = findValidPlacement(state)
  if (!move) throw new Error('Не найдено легальное место для текущего тайла')
  return move
}

/** Подбирает место и поворот, который нарушает совпадение сторон с соседями. */
export function findInvalidPlacement(state: PlacementState): ValidMove | null {
  const tile = state.currentTile ?? null
  if (!tile?.sides) return null

  for (const place of state.availablePlacesTiles ?? []) {
    for (let rotation = 1; rotation < 4; rotation += 1) {
      const sides = rotateSides(tile.sides, rotation)
      if (!isValidPosition(state, sides, place.rowIndex, place.tileIndex)) {
        return {
          tile: {
            ...tile,
            sides,
            rotation: (tile.rotation + rotation * 90) % 360,
          },
          rowIndex: place.rowIndex,
          tileIndex: place.tileIndex,
        }
      }
    }
  }
  return null
}

/** Как findInvalidPlacement, но падает: тесту нужен заведомо неверный ход. */
export function requireInvalidPlacement(state: PlacementState): ValidMove {
  const move = findInvalidPlacement(state)
  if (!move) throw new Error('Не найдено заведомо неверное размещение')
  return move
}

/**
 * Поворот, отличный от текущего: команда, которая меняет только превью тайла
 * и не двигает очередь. Удобна для проверок, где ход не должен уводить партию
 * дальше, а важен только порядок обработки команд.
 */
export function alternateRotation(state: PlacementState): number {
  const rotation = state.currentTile?.rotation
  if (rotation === undefined) throw new Error('У партии нет текущего тайла')
  return rotation === 180 ? 90 : 180
}

export function countPlacedTiles(
  tilePlacesStats: GameStateSnapshot['tilePlacesStats']
): number {
  return Object.values(tilePlacesStats).reduce(
    (count, row) => count + Object.keys(row ?? {}).length,
    0
  )
}

// ----------------------------------------------------------- лобби и старт игры

/** Стартует игру и возвращает первый «человеческий» срез состояния */
export async function startGame(
  client: TestClient,
  gameId: string
): Promise<GameStateSnapshot> {
  client.emit(SocketEvents.StartGame, { gameId })
  const started = await latestGame(
    client,
    (game) => game.gameIsStarted === true
  )
  return started as GameStateSnapshot
}

/**
 * Дожидается стабильного хода игрока: хода и «тишины» на сервере.
 *
 * Сервер может планировать цепочки компьютерных ходов внахлёст (на каждое
 * человеческое действие placeTile/placeFollower/skipFollower), поэтому событие
 * «ход Алисы» может оказаться промежуточным срезом. Здесь мы последовательно
 * вычитываем gameUpdated до тех пор, пока не наступит тишина (quietMs без
 * новых событий), и возвращаем ПОСЛЕДНИЙ состоятельный срез хода игрока.
 */
export async function waitForHumanTurnOrEnd(
  client: TestClient,
  playerIdValue: number,
  options: {
    quietMs?: number
    timeoutMs?: number
    initialState?: GameStateSnapshot
  } = {}
): Promise<GameStateSnapshot> {
  const quietMs = options.quietMs ?? 250
  const timeoutMs = options.timeoutMs ?? 30_000

  const isPlayerState = (game: GameStateSnapshot): boolean =>
    Boolean(game.gameIsEnded) ||
    (Boolean(game.gameIsStarted) &&
      game.currentPlayer?.id === playerIdValue &&
      !game.isPlacingFollower)

  const seeded = options.initialState
  let lastPlayerState: GameStateSnapshot | null =
    seeded && isPlayerState(seeded) ? seeded : null

  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    let event: unknown
    try {
      event = await client.waitForEvent(
        SocketEvents.GameUpdated,
        () => true,
        quietMs
      )
    } catch {
      if (lastPlayerState) return lastPlayerState
      // Пока ход игрока ещё не наблюдался, quietMs — лишь интервал опроса.
      // Цепочка ИИ может молчать дольше этого интервала, особенно под нагрузкой
      // CI; продолжаем ждать до общего timeoutMs.
      continue
    }

    const game = event as GameStateSnapshot
    if (isPlayerState(game)) {
      lastPlayerState = game
    } else if (game.gameIsStarted && !game.gameIsEnded) {
      // Очередь ушла в чужой ход — снимок хода игрока устарел даже если
      // был получен ранее, ждём следующий.
      lastPlayerState = null
    }
  }

  if (lastPlayerState) return lastPlayerState
  throw new Error(`Таймаут ожидания хода игрока ${playerIdValue}`)
}

// ------------------------------------------------------------- ход игрока

export interface HumanMoveResult {
  move: ValidMove
  game: GameStateSnapshot
  placedFollower: FollowerPlaceSnapshot | null
}

/**
 * Ставит тайл хода: поворот сначала синхронизируется с сервером, как это
 * делает интерфейс, иначе «подсказки» для фишек не совпали бы с размещённым
 * тайлом. Возвращает состояние после размещения.
 */
async function placeTurnTile(
  client: TestClient,
  gameId: string,
  move: ValidMove
): Promise<GameStateSnapshot> {
  await client.emitAck(SocketEvents.UpdateCurrentTile, {
    gameId,
    rotation: move.tile.rotation,
  })
  const placed = await client.emitAck<GameAck>(SocketEvents.PlaceTile, {
    gameId,
    position: { rowIndex: move.rowIndex, tileIndex: move.tileIndex },
  })
  return placed.game
}

/** Завершает ход без фишки: мест для неё нет или нет подходящего типа. */
async function skipTurnFollower(
  client: TestClient,
  gameId: string
): Promise<GameStateSnapshot> {
  const skipped = await client.emitAck<GameAck>(SocketEvents.SkipFollower, {
    gameId,
  })
  return skipped.game
}

/** Выполняет один полный ход человека: тайл + (опционально) фишка/пропуск */
export async function makeHumanMove(
  client: TestClient,
  gameId: string,
  state: GameStateSnapshot
): Promise<HumanMoveResult> {
  const move = requireValidPlacement(state)

  let game = await placeTurnTile(client, gameId, move)
  let placedFollower: FollowerPlaceSnapshot | null = null

  if (game.isPlacingFollower) {
    const place = game.availableFollowersPlaces?.[0]
    const currentId = game.currentPlayer?.id
    const pool =
      currentId === undefined
        ? undefined
        : game.playersFollowers?.[String(currentId)]
    const followerType = place ? chooseFollowerType(place, pool) : null

    if (place && followerType) {
      placedFollower = place
      const follower = await client.emitAck<GameAck>(
        SocketEvents.PlaceFollower,
        {
          gameId,
          place,
          followerType,
        }
      )
      game = follower.game
    } else {
      game = await skipTurnFollower(client, gameId)
    }
  }

  return { move, game, placedFollower }
}

/** Предпочитает дорогу (они замыкаются чаще всего), иначе первый вариант */
export function chooseFollowerPlace(
  places: FollowerPlaceSnapshot[]
): FollowerPlaceSnapshot {
  return (
    places.find((place) => place.point.pointType === TileSideType.Road) ??
    places[0]
  )
}

/**
 * Тип фишки для предложенного места, как в клиентском интерфейсе: сад только
 * аббатом, монастырь — обычный подданный, а при пустом запасе обычных
 * подданных — аббат. Сервер отклоняет фишку, которой нет в запасе, и в
 * этом случае молча завершает ход, поэтому тип выбирается по запасу.
 * `null` — допустимого типа нет, выставление нужно пропустить.
 */
export function chooseFollowerType(
  place: FollowerPlaceSnapshot,
  pool: FollowerCountSnapshot | undefined
): FollowerType | null {
  const isGarden = Boolean(place.temporaryObject.isGarden)
  const isCenter = isGarden || Boolean(place.temporaryObject.isMonastery)
  const hasOrdinary = Boolean(pool?.ordinaryFollowers)

  if (isGarden || (isCenter && !hasOrdinary)) {
    return pool?.monks ? FollowerType.Abbot : null
  }
  if (isCenter || hasOrdinary) return FollowerType.Follower
  return null
}

/** Играет ходы до тех пор, пока сервер не предложит разместить фишку */
export async function driveTurnsUntilFollowerOffer(
  client: TestClient,
  gameId: string,
  aliceId: number,
  maxTurns = 40
): Promise<{
  preState: GameStateSnapshot | null
  offerGame: GameStateSnapshot | null
}> {
  let state = await startGame(client, gameId)

  for (let turn = 0; turn < maxTurns; turn++) {
    if (state.gameIsEnded) return { preState: null, offerGame: null }
    state = await waitForHumanTurnOrEnd(client, aliceId, {
      initialState: state,
    })
    if (state.gameIsEnded) return { preState: null, offerGame: null }

    const move = requireValidPlacement(state)

    let game = await placeTurnTile(client, gameId, move)
    if (game.isPlacingFollower && game.availableFollowersPlaces?.length) {
      return { preState: state, offerGame: game }
    }
    if (game.isPlacingFollower) {
      game = await skipTurnFollower(client, gameId)
    }

    state = game
  }

  return { preState: null, offerGame: null }
}

// ------------------------------------------------ независимый оракул подсчёта

function countUniqueTiles(
  points: ObjectPoint[],
  tilePlacesStats: GameStateSnapshot['tilePlacesStats']
): number {
  const unique = new Set<string>()
  for (const point of points) {
    if (tilePlacesStats[point.y]?.[point.x]) {
      unique.add(`${point.y},${point.x}`)
    }
  }
  return unique.size
}

function countCityPoints(
  city: BaseObjectSnapshot,
  tilePlacesStats: GameStateSnapshot['tilePlacesStats']
): { tiles: number; shields: number } {
  const unique = new Set<string>()
  let shields = 0
  for (const point of city.points) {
    const tile = tilePlacesStats[point.y]?.[point.x]
    if (tile && !unique.has(`${point.y},${point.x}`)) {
      unique.add(`${point.y},${point.x}`)
      if (tile.withShield) shields++
    }
  }
  return { tiles: unique.size, shields }
}

/**
 * Кто получает очки: игроки с максимальным числом подданных в объекте.
 * Это отдельная тестовая модель, намеренно не импортирующая production scoring.
 */
export function scoringWinners(
  pointsValue: number,
  followers: ObjectFollowerSnapshot[]
): Record<string, number> {
  if (!followers.length) return {}

  const counts: Record<string, number> = {}
  for (const follower of followers) {
    const key = playerId(follower.playerId)
    counts[key] = (counts[key] ?? 0) + 1
  }

  const maxCount = Math.max(...Object.values(counts))
  const players: Record<string, number> = {}
  for (const [pid, count] of Object.entries(counts)) {
    if (count === maxCount) players[pid] = pointsValue
  }
  return players
}

/** Очки дороги и города одним числом: сумма делится между лидерами. */
interface ExpectedObjectScore {
  total: number
  players: Record<string, number>
}

/**
 * Ожидаемый счёт объекта: сумма целиком, если на ней нет фишек, иначе она
 * делится поровну между игроками с максимальным числом подданных.
 */
function expectedObjectScore(
  points: number,
  followers: ObjectFollowerSnapshot[]
): ExpectedObjectScore {
  const players = scoringWinners(points, followers)
  return {
    total: followers.length ? points * Object.keys(players).length : points,
    players,
  }
}

function roadScore(
  road: BaseObjectSnapshot,
  tilePlacesStats: GameStateSnapshot['tilePlacesStats']
): ExpectedObjectScore {
  return expectedObjectScore(
    countUniqueTiles(road.points, tilePlacesStats),
    road.followers
  )
}

function cityScore(
  city: BaseObjectSnapshot,
  tilePlacesStats: GameStateSnapshot['tilePlacesStats']
): ExpectedObjectScore {
  const { tiles, shields } = countCityPoints(city, tilePlacesStats)
  return expectedObjectScore(tiles * 2 + shields * 2, city.followers)
}

/**
 * Независимо пересчитывает базовые очки игроков по завершённым объектам и
 * доске. Модель рассчитана на обычные дороги, города, монастыри и сады;
 * изменение production scoring должно независимо отражаться здесь и в
 * интеграционных сценариях, а не подхватываться общим кодом подсчёта.
 */
export function recomputeExpectedScores(
  completed: CompletedObjectsSnapshot,
  tilePlacesStats: GameStateSnapshot['tilePlacesStats'],
  players: GameSummaryPlayer[]
): Record<string, number> {
  const expected: Record<string, number> = {}
  for (const p of players) expected[playerId(p.id)] = 0

  const credit = (pid: number | string, value: number) => {
    expected[playerId(pid)] = (expected[playerId(pid)] ?? 0) + value
  }

  const creditObject = (score: ExpectedObjectScore) => {
    for (const [pid, value] of Object.entries(score.players)) credit(pid, value)
  }

  for (const road of completed.roads)
    creditObject(roadScore(road, tilePlacesStats))
  for (const city of completed.cities)
    creditObject(cityScore(city, tilePlacesStats))

  for (const monastery of completed.monasteries) {
    for (const follower of monastery.followers) {
      // Аббат на завершённом монастыре очков не приносит (он ждёт отзыва)
      if (follower.isAbbot) continue
      credit(follower.playerId, 9)
    }
  }

  for (const garden of completed.gardens) {
    for (const follower of garden.followers) {
      // Аббат на завершённом саду очков не приносит (он ждёт отзыва)
      if (follower.isAbbot) continue
      credit(follower.playerId, 9)
    }
  }

  return expected
}

/**
 * Сверяет ответ настоящего сервера с независимым оракулом базовых правил:
 * дороги, города с гербами, монастыри и сады. Оракул не покрывает бонусы
 * дополнений, поэтому его используют в базовых интеграционных партиях.
 */
export function verifyScoringAgainstServer(state: GameStateSnapshot): void {
  const completed = state.completedObjects ?? {
    cities: [],
    roads: [],
    monasteries: [],
    gardens: [],
  }
  const expected = recomputeExpectedScores(
    completed,
    state.tilePlacesStats,
    state.players ?? []
  )
  expect(state.scores ?? {}).toEqual(expected)

  for (const road of completed.roads) {
    const { total, players } = roadScore(road, state.tilePlacesStats)
    expect(road.score?.total).toBe(total)
    expect(road.score?.players).toEqual(players)
  }

  for (const city of completed.cities) {
    const { total, players } = cityScore(city, state.tilePlacesStats)
    expect(city.score?.total).toBe(total)
    expect(city.score?.players).toEqual(players)
  }
}

/** Проверяет, что запас и выставленные фишки каждого игрока сохраняют баланс. */
export function assertFollowerInvariants(state: GameStateSnapshot): void {
  if (!state.playersFollowers || !state.placedFollowers || !state.players) {
    return
  }

  let totalPlaced = 0
  let totalOrdinary = 0
  let totalMonks = 0

  // Завершённое строение снимает все свои фишки с доски (возврат в запас).
  // Поэтому ни одна фишка из placedFollowers не может ссылаться на объект,
  // который уже попал в completedObjects.
  const completedObjectIds = new Set<string>()
  if (state.completedObjects) {
    const completedGroups = [
      state.completedObjects.roads,
      state.completedObjects.cities,
      state.completedObjects.monasteries,
      state.completedObjects.gardens ?? [],
    ]
    for (const group of completedGroups) {
      for (const object of group) completedObjectIds.add(object.id)
    }
  }
  for (const follower of state.placedFollowers) {
    // Аббат остаётся на завершённом монастыре до отзыва владельцем —
    // для него ссылка на завершённый объект допустима.
    if (follower.isAbbot) continue
    expect(completedObjectIds.has(follower.objectId)).toBe(false)
  }

  for (const player of state.players) {
    const placedCount = state.placedFollowers.filter(
      (follower) => playerId(follower.playerId) === playerId(player.id)
    ).length
    const remaining =
      state.playersFollowers[playerId(player.id)]?.ordinaryFollowers
    const monks = state.playersFollowers[playerId(player.id)]?.monks
    if (remaining === undefined) continue

    expect(remaining).toBeGreaterThanOrEqual(0)
    expect(remaining).toBeLessThanOrEqual(7)
    expect(monks).toBeGreaterThanOrEqual(0)
    expect(monks).toBeLessThanOrEqual(1)

    expect(placedCount + remaining + (monks ?? 0)).toBe(8)

    totalPlaced += placedCount
    totalOrdinary += remaining
    totalMonks += monks ?? 0
  }

  const totalAvailable = 8 * state.players.length
  expect(totalPlaced + totalOrdinary + totalMonks).toBe(totalAvailable)
}

// ------------------------------------------------------- полная партия

export interface GamePlayStats {
  aliceTurns: number
  followersPlaced: number
  aliceFollowerReturns: number
  aliceFollowedObjects: number
  aliceFollowersOnBoardAtEnd: number
  completedAtEnd: { roads: number; cities: number; monasteries: number }
  endState: GameStateSnapshot
}

export interface PlayFullGameOptions {
  maxTurns?: number
  onState?: (state: GameStateSnapshot) => void
}

/**
 * Играет всю партию: за каждую очередь Алисы делает ход, ждёт
 * компьютерные ходы и на каждом устойчивом состоянии проверяет
 * инварианты счёта и фишек, а также отслеживает возврат её фишек.
 */
export async function playFullGame(
  client: TestClient,
  gameId: string,
  aliceId: number,
  options: PlayFullGameOptions = {}
): Promise<GamePlayStats> {
  const { maxTurns = 100, onState } = options

  let state = await startGame(client, gameId)

  const stats: GamePlayStats = {
    aliceTurns: 0,
    followersPlaced: 0,
    aliceFollowerReturns: 0,
    aliceFollowedObjects: 0,
    aliceFollowersOnBoardAtEnd: 0,
    completedAtEnd: { roads: 0, cities: 0, monasteries: 0 },
    endState: state,
  }

  const aliceEverFollowedObjects = new Set<string>()
  const aliceFollowersOnBoard = new Set<string>()

  const processState = (s: GameStateSnapshot) => {
    verifyScoringAgainstServer(s)
    assertFollowerInvariants(s)
    onState?.(s)

    const alicePlaced = (s.placedFollowers ?? []).filter(
      (follower) => playerId(follower.playerId) === playerId(aliceId)
    )
    const currentIds = new Set(
      alicePlaced.map((follower) => String(follower.objectId))
    )
    for (const objectId of currentIds) aliceEverFollowedObjects.add(objectId)

    for (const objectId of aliceFollowersOnBoard) {
      if (!currentIds.has(objectId)) {
        // Фишка исчезла с доски (строение завершено и счёт начислен) —
        // объект засчитывается как «возвращённый» ровно один раз.
        stats.aliceFollowerReturns++
        aliceFollowersOnBoard.delete(objectId)
      }
    }
    for (const objectId of currentIds) aliceFollowersOnBoard.add(objectId)
  }

  processState(state)

  while (!state.gameIsEnded && stats.aliceTurns < maxTurns) {
    const { game, placedFollower } = await makeHumanMove(client, gameId, state)
    if (placedFollower) stats.followersPlaced++
    stats.aliceTurns++

    if (game.gameIsEnded) {
      state = game
      processState(state)
      break
    }

    state = await waitForHumanTurnOrEnd(client, aliceId, {
      initialState: game,
    })
    processState(state)
  }

  if (!state.gameIsEnded) {
    throw new Error('Игра не завершилась за отведённое число ходов')
  }

  stats.endState = state
  stats.aliceFollowedObjects = aliceEverFollowedObjects.size
  stats.aliceFollowersOnBoardAtEnd = aliceFollowersOnBoard.size
  stats.completedAtEnd.roads = state.completedObjects?.roads.length ?? 0
  stats.completedAtEnd.cities = state.completedObjects?.cities.length ?? 0
  stats.completedAtEnd.monasteries =
    state.completedObjects?.monasteries.length ?? 0

  return stats
}
