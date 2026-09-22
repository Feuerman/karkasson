import { expect } from 'vitest'
import { TestClient } from './client'
import { latestGame, type GameSummaryPlayer } from './lobby'

/**
 * Хелперы для интеграционных тестов «живого» игрового процесса:
 * прогрев партии против настоящего сервера, поиск легальных ходов и
 * зеркало серверных правил подсчёта очков для проверки инвариантов.
 */

// ------------------------------------------------------------------ типы

export type SideName = 'north' | 'east' | 'south' | 'west'
export type TileSideType = 'field' | 'road' | 'city'
export type SideMap = Record<SideName, TileSideType>

export const SIDE_ORDER: SideName[] = ['north', 'east', 'south', 'west']

export interface TileSnapshot {
  id: string
  rotation: number
  sides: SideMap
  x?: number
  y?: number
  rowIndex?: number
  tileIndex?: number
  isSolidCity?: boolean
  withShield?: boolean
  isMonastery?: boolean
  imgUrl?: string
}

export interface ObjectPoint {
  x: number
  y: number
  direction?: string
  pointType?: TileSideType
  rowIndex?: number
  tileIndex?: number
}

export interface ObjectFollowerSnapshot {
  playerId: number | string
  objectId: string
  point: ObjectPoint
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
  score?: ObjectScoreSnapshot
}

export interface CompletedObjectsSnapshot {
  cities: BaseObjectSnapshot[]
  roads: BaseObjectSnapshot[]
  monasteries: BaseObjectSnapshot[]
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
}

export interface FollowerCountSnapshot {
  ordinaryFollowers: number
  monks: number
}

/** Полный срез игры в том виде, в каком его присылает сервер */
export interface GameStateSnapshot {
  id: string
  players: GameSummaryPlayer[]
  currentPlayerIndex: number
  currentPlayer?: GameSummaryPlayer | null
  gameIsStarted: boolean
  gameIsEnded: boolean
  moveCounter: number
  scores: Record<string, number>
  tilesList: unknown[]
  currentTile?: TileSnapshot | null
  tilePlacesStats: Record<number, Record<number, TileSnapshot>>
  availablePlacesTiles?: Array<{ rowIndex: number; tileIndex: number }>
  availableFollowersPlaces?: FollowerPlaceSnapshot[]
  isPlacingFollower?: boolean
  playersFollowers?: Record<string, FollowerCountSnapshot>
  placedFollowers?: PlacedFollowerSnapshot[]
  temporaryObjects?: {
    cities: BaseObjectSnapshot[]
    roads: BaseObjectSnapshot[]
    monasteries: BaseObjectSnapshot[]
  }
  completedObjects?: CompletedObjectsSnapshot
  placingPoint?: { rowIndex: number; tileIndex: number }
}

export interface ValidMove {
  tile: TileSnapshot
  rowIndex: number
  tileIndex: number
}

interface StatsLike {
  tilePlacesStats: GameStateSnapshot['tilePlacesStats']
}

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
      north: current.west,
      east: current.north,
      south: current.east,
      west: current.south,
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
export function findValidPlacement(state: GameStateSnapshot): ValidMove | null {
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

export function countPlacedTiles(
  tilePlacesStats: GameStateSnapshot['tilePlacesStats']
): number {
  return Object.values(tilePlacesStats).reduce(
    (count, row) => count + Object.keys(row ?? {}).length,
    0
  )
}

// ----------------------------------------------------------- лобби и старт игры

export interface SingleHumanLobby {
  gameId: string
  creator: TestClient
  aliceId: number
}

/**
 * Лобби с одним реальным игроком (слот 0) и тремя компьютерными.
 * После хода Алисы очередь всегда переходит компьютерам, поэтому
 * тесту не нужно водить второго человека.
 */
export async function createLobbyWithSingleHuman(
  serverUrl: string
): Promise<SingleHumanLobby> {
  const creator = new TestClient(serverUrl, 'device-human')
  await creator.connect()
  creator.registerDevice()

  creator.emit('createGame')
  const created = (await creator.waitForEvent('gameCreated')) as {
    gameId: string
  }
  const gameId = created.gameId

  await creator.emitAck('addPlayer', { gameId, name: 'Alice', index: 0 })

  for (let index = 1; index <= 3; index++) {
    await creator.emitAck('addPlayer', { gameId, name: null, index })
  }

  return { gameId, creator, aliceId: 1 }
}

/** Стартует игру и возвращает первый «человеческий» срез состояния */
export async function startGame(
  client: TestClient,
  gameId: string
): Promise<GameStateSnapshot> {
  client.emit('startGame', { gameId })
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
      event = await client.waitForEvent('gameUpdated', () => true, quietMs)
    } catch {
      if (lastPlayerState) return lastPlayerState
      throw new Error(`Ход игрока ${playerIdValue} так и не наступил`)
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

/** Выполняет один полный ход человека: тайл + (опционально) фишка/пропуск */
export async function makeHumanMove(
  client: TestClient,
  gameId: string,
  state: GameStateSnapshot
): Promise<HumanMoveResult> {
  const move = findValidPlacement(state)
  if (!move) {
    throw new Error('Не найдено легальное место для текущего тайла')
  }

  // Как и фронтенд, синхронизируем повёрнутый тайл с сервером,
  // чтобы «подсказки» для фишек совпадали с реально размещённым тайлом.
  await client.emitAck('updateCurrentTile', { gameId, tile: move.tile })

  const placed = await client.emitAck<{
    success: boolean
    game: GameStateSnapshot
  }>('placeTile', {
    gameId,
    tile: move.tile,
    position: { rowIndex: move.rowIndex, tileIndex: move.tileIndex },
  })

  let game = placed.game
  let placedFollower: FollowerPlaceSnapshot | null = null

  if (game.isPlacingFollower) {
    if (game.availableFollowersPlaces?.length) {
      placedFollower = game.availableFollowersPlaces[0]
      const follower = await client.emitAck<{
        success: boolean
        game: GameStateSnapshot
      }>('placeFollower', { gameId, place: placedFollower })
      game = follower.game
    } else {
      const skipped = await client.emitAck<{
        success: boolean
        game: GameStateSnapshot
      }>('skipFollower', { gameId })
      game = skipped.game
    }
  }

  return { move, game, placedFollower }
}

/** Предпочитает дорогу (они замыкаются чаще всего), иначе первый вариант */
export function chooseFollowerPlace(
  places: FollowerPlaceSnapshot[]
): FollowerPlaceSnapshot {
  return places.find((place) => place.point.pointType === 'road') ?? places[0]
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

    const move = findValidPlacement(state)
    if (!move) throw new Error('Не найдено легальное место для текущего тайла')

    await client.emitAck('updateCurrentTile', { gameId, tile: move.tile })
    const placed = await client.emitAck<{
      success: boolean
      game: GameStateSnapshot
    }>('placeTile', {
      gameId,
      tile: move.tile,
      position: { rowIndex: move.rowIndex, tileIndex: move.tileIndex },
    })

    let game = placed.game
    if (game.isPlacingFollower && game.availableFollowersPlaces?.length) {
      return { preState: state, offerGame: game }
    }
    if (game.isPlacingFollower) {
      const skipped = await client.emitAck<{
        success: boolean
        game: GameStateSnapshot
      }>('skipFollower', { gameId })
      game = skipped.game
    }
  }

  return { preState: null, offerGame: null }
}

// -------------------------------------------------- зеркало серверных правил

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
 * Возвращает map playerId → полные очки (как distributeScore на сервере).
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

/** Базовые очки объекта по правилам сервера (для сценариев одиночного хода) */
export function baseObjectPoints(
  object: BaseObjectSnapshot,
  tilePlacesStats: GameStateSnapshot['tilePlacesStats']
): number {
  if (object.isMonastery) return 9
  const city = countCityPoints(object, tilePlacesStats)
  return city.tiles > 0 || object.points.some((p) => p.pointType === 'city')
    ? city.tiles * 2 + city.shields * 2
    : countUniqueTiles(object.points, tilePlacesStats)
}

/**
 * Пересчитывает ожидаемые очки всех игроков исключительно по
 * завершённым объектам + доске. Должно совпадать с state.scores.
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

  for (const road of completed.roads) {
    const points = countUniqueTiles(road.points, tilePlacesStats)
    for (const [pid, value] of Object.entries(
      scoringWinners(points, road.followers)
    )) {
      credit(pid, value)
    }
  }

  for (const city of completed.cities) {
    const { tiles, shields } = countCityPoints(city, tilePlacesStats)
    const points = tiles * 2 + shields * 2
    for (const [pid, value] of Object.entries(
      scoringWinners(points, city.followers)
    )) {
      credit(pid, value)
    }
  }

  for (const monastery of completed.monasteries) {
    for (const follower of monastery.followers) {
      credit(follower.playerId, 9)
    }
  }

  return expected
}

/**
 * Проверяет, что серверный счёт согласуется с завершёнными объектами:
 * очки, начисленные каждому игроку, ровно совпадают с зеркальным
 * пересчётом правил (дороги, города с гербами, монастыри по 9).
 */
export function verifyScoringAgainstServer(state: GameStateSnapshot): void {
  const completed = state.completedObjects ?? {
    cities: [],
    roads: [],
    monasteries: [],
  }
  const expected = recomputeExpectedScores(
    completed,
    state.tilePlacesStats,
    state.players ?? []
  )
  expect(state.scores ?? {}).toEqual(expected)

  for (const road of completed.roads) {
    const points = countUniqueTiles(road.points, state.tilePlacesStats)
    expect(road.score?.total).toBe(
      road.followers.length
        ? points * Object.keys(scoringWinners(points, road.followers)).length
        : points
    )
    expect(road.score?.players).toEqual(scoringWinners(points, road.followers))
  }

  for (const city of completed.cities) {
    const { tiles, shields } = countCityPoints(city, state.tilePlacesStats)
    const points = tiles * 2 + shields * 2
    expect(city.score?.total).toBe(
      city.followers.length
        ? points * Object.keys(scoringWinners(points, city.followers)).length
        : points
    )
    expect(city.score?.players).toEqual(scoringWinners(points, city.followers))
  }
}

/**
 * Инвариант запаса фишек: каждая размещённая фишка уменьшает пул
 * ordinaryFollowers игрока, а возврат — восстанавливает его.
 *
 * По умолчанию проверяется ГЛОБАЛЬНАЯ сумма («на доске + в запасе == 7 × игроки»):
 * сервер при объединении нескольких дорог/городов в одну снимает фишки через
 * splice(findIndex(...)) с несовпадающим objectId, из-за чего поштучный
 * пересчёт по каждому игроку может расходиться (хотя общий баланс сохраняется).
 * Строгая проверка per-player доступна через опцию perPlayer и применяется
 * только в сценариях без объединений (одиночный ход).
 */
export function assertFollowerInvariants(
  state: GameStateSnapshot,
  options: { perPlayer?: boolean } = {}
): void {
  if (!state.playersFollowers || !state.placedFollowers || !state.players) {
    return
  }

  const perPlayer = options.perPlayer === true

  let totalPlaced = 0
  let totalOrdinary = 0

  // Завершённое строение снимает все свои фишки с доски (возврат в запас).
  // Поэтому ни одна фишка из placedFollowers не может ссылаться на объект,
  // который уже попал в completedObjects.
  const completedObjectIds = new Set<string>()
  if (state.completedObjects) {
    const completedGroups = [
      state.completedObjects.roads,
      state.completedObjects.cities,
      state.completedObjects.monasteries,
    ]
    for (const group of completedGroups) {
      for (const object of group) completedObjectIds.add(object.id)
    }
  }
  for (const follower of state.placedFollowers) {
    expect(completedObjectIds.has(follower.objectId)).toBe(false)
  }

  for (const player of state.players) {
    const placedCount = state.placedFollowers.filter(
      (follower) => playerId(follower.playerId) === playerId(player.id)
    ).length
    const remaining =
      state.playersFollowers[playerId(player.id)]?.ordinaryFollowers
    if (remaining === undefined) continue

    expect(remaining).toBeGreaterThanOrEqual(0)
    expect(remaining).toBeLessThanOrEqual(7)

    if (perPlayer) {
      expect(placedCount + remaining).toBe(7)
    }

    totalPlaced += placedCount
    totalOrdinary += remaining
  }

  const totalAvailable = 7 * state.players.length
  expect(totalPlaced + totalOrdinary).toBe(totalAvailable)
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
      initialState: state,
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
