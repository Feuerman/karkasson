import { describe, expect, it, vi } from 'vitest'
import { princessAndDragonTiles } from '@server/data/princessAndDragonTiles'
import { GameManager } from '@server/modules/GameManager'
import {
  ActionTypes,
  ObjectTypes,
  SideName,
  TileSideType,
  type Player,
} from '@server/modules/types'

const players: Player[] = [1, 2].map((id) => ({
  id,
  name: `Player ${id}`,
  color: 'coral',
  score: 0,
  socketId: `socket-${id}`,
  deviceId: `device-${id}`,
}))

function fieldTile(id: string, x: number, hasVolcano = false) {
  return {
    id,
    rotation: 0,
    x,
    y: 15,
    sides: {
      [SideName.North]: TileSideType.Field,
      [SideName.East]: TileSideType.Field,
      [SideName.South]: TileSideType.Field,
      [SideName.West]: TileSideType.Field,
    },
    hasVolcano,
  }
}

describe('Правила дополнения «Принцесса и дракон»', () => {
  it('включает набор только по флагу', () => {
    const disabledGame = new GameManager({ startImmediately: false })
    const enabledGame = new GameManager({
      startImmediately: false,
      princessAndDragonEnabled: true,
    })

    expect(disabledGame.tilesList.some(({ id }) => id === 'PAD_A')).toBe(false)
    expect(enabledGame.tilesList.some(({ id }) => id === 'PAD_A')).toBe(true)
  })

  it('пропускает тайл дракона до первого вулкана и оставляет его в колоде', () => {
    const game = new GameManager({
      startImmediately: false,
      princessAndDragonEnabled: true,
    })
    const dragonTile = princessAndDragonTiles.find(({ hasDragon }) => hasDragon)
    const replacementTile = fieldTile('replacement', 0)
    const anotherTile = fieldTile('another', 0)
    expect(dragonTile).toBeDefined()
    expect(replacementTile).toBeDefined()
    if (!dragonTile || !replacementTile) return

    game.tilesList = [
      { ...dragonTile, rotation: 0 },
      { ...replacementTile, rotation: 0 },
      { ...anotherTile, rotation: 0 },
    ]
    game.tilePlacesStats = {
      15: { 15: { ...fieldTile('start', 15), rowIndex: 15 } },
    }
    game.availablePlacesTiles = [{ rowIndex: 15, tileIndex: 16, objects: [] }]

    const random = vi.spyOn(Math, 'random').mockReturnValue(0.5)
    try {
      game.getRandomTileFromList()
    } finally {
      random.mockRestore()
    }

    expect(game.currentTile?.id).toBe(replacementTile.id)
    expect(game.tilesList.map(({ id }) => id)).toEqual([
      dragonTile.id,
      anotherTile.id,
    ])
    expect(game.tileHistory.map(({ id }) => id)).toEqual([replacementTile.id])
  })

  it('выдаёт отложенный тайл дракона после появления вулкана', () => {
    const game = new GameManager({
      startImmediately: false,
      princessAndDragonEnabled: true,
    })
    const dragonTile = princessAndDragonTiles.find(({ hasDragon }) => hasDragon)
    expect(dragonTile).toBeDefined()
    if (!dragonTile) return

    game.tilePlacesStats = {
      15: { 15: { ...fieldTile('volcano', 15, true), rowIndex: 15 } },
    }
    game.availablePlacesTiles = [{ rowIndex: 15, tileIndex: 16, objects: [] }]
    game.tilesList = [{ ...dragonTile, rotation: 0 }]

    game.getRandomTileFromList()

    expect(game.currentTile?.id).toBe(dragonTile.id)
    expect(game.tilesList).toHaveLength(0)
    expect(game.tileHistory.map(({ id }) => id)).toEqual([dragonTile.id])
  })

  it('перемещает дракона только на соседний не посещённый тайл и возвращает сбитую фишку', () => {
    const game = new GameManager({
      players,
      startImmediately: false,
      princessAndDragonEnabled: true,
    })
    game.dragonPosition = { rowIndex: 15, tileIndex: 10 }
    game.dragonMove = {
      remainingSteps: 2,
      nextPlayerIndex: 0,
      resumePlayerIndex: 0,
      visited: [{ rowIndex: 15, tileIndex: 10 }],
    }
    game.tilePlacesStats = {
      15: {
        10: fieldTile('volcano', 10, true),
        11: fieldTile('occupied', 11),
      },
    }
    game.tilesList = []
    game.currentPlayer = players[0] ?? null
    game.currentPlayerIndex = 0
    game.playersFollowers[1].ordinaryFollowers = 6
    const point = { x: 11, y: 15, direction: SideName.North }
    game.temporaryObjects.roads.push({
      id: 'road-with-follower',
      points: [{ ...point, pointType: TileSideType.Road }],
      followers: [{ playerId: 1, objectId: 'road-with-follower', point }],
    })
    game.placedFollowers.push({
      playerId: 1,
      objectId: 'road-with-follower',
      point,
    })

    expect(game.moveDragon(14, 10)).toBe(false)
    expect(game.moveDragon(15, 10)).toBe(false)
    expect(game.dragonPosition).toEqual({ rowIndex: 15, tileIndex: 10 })
    expect(game.dragonMove?.remainingSteps).toBe(2)
    expect(game.currentPlayerIndex).toBe(0)
    expect(game.playersFollowers[1]?.ordinaryFollowers).toBe(6)
    expect(game.placedFollowers).toHaveLength(1)

    expect(game.moveDragon(15, 11)).toBe(true)
    expect(game.dragonPosition).toEqual({ rowIndex: 15, tileIndex: 11 })
    expect(game.playersFollowers[1].ordinaryFollowers).toBe(7)
    expect(game.placedFollowers).toHaveLength(0)
    expect(game.dragonMove).toBeUndefined()

    const dragonAction = game.actionsHistory.find(
      (action) => action.actionType === ActionTypes.DRAGON_MOVE
    )
    expect(dragonAction?.actionData).toEqual({
      from: { rowIndex: 15, tileIndex: 10 },
      to: { rowIndex: 15, tileIndex: 11 },
      eatenFollowers: [
        {
          playerId: 1,
          objectId: 'road-with-follower',
          point,
          objectType: ObjectTypes.ROAD,
        },
      ],
      remainingSteps: 1,
    })
    expect(dragonAction?.initiator?.id).toBe(players[0]?.id)
    // Съеденные драконом подданные перечислены в его шаге и сразу после него
    // возвращены владельцам отдельной записью.
    expect(game.actionsHistory.map(({ actionType }) => actionType)).toEqual([
      ActionTypes.DRAGON_MOVE,
      ActionTypes.BACK_FOLLOWER,
    ])
    const backAction = game.actionsHistory[1]
    expect(
      backAction?.actionType === ActionTypes.BACK_FOLLOWER &&
        backAction.actionData.followers
    ).toEqual([
      {
        playerId: 1,
        objectId: 'road-with-follower',
        point,
        objectType: ObjectTypes.ROAD,
      },
    ])
  })

  it('записывает шаг дракона без съеденных подданных и фиксирует инициатора', () => {
    const game = new GameManager({
      players,
      startImmediately: false,
      princessAndDragonEnabled: true,
    })
    game.dragonPosition = { rowIndex: 15, tileIndex: 10 }
    game.dragonMove = {
      remainingSteps: 2,
      nextPlayerIndex: 0,
      resumePlayerIndex: 0,
      visited: [{ rowIndex: 15, tileIndex: 10 }],
    }
    game.tilePlacesStats = {
      15: {
        10: fieldTile('volcano', 10, true),
        11: fieldTile('empty', 11),
      },
    }
    game.tilesList = []

    expect(game.moveDragon(15, 11)).toBe(true)

    expect(game.actionsHistory).toHaveLength(1)
    const dragonAction = game.actionsHistory[0]
    expect(dragonAction?.actionType).toBe(ActionTypes.DRAGON_MOVE)
    expect(
      dragonAction?.actionType === ActionTypes.DRAGON_MOVE &&
        dragonAction.actionData.eatenFollowers
    ).toEqual([])
  })

  it('съедает подданного на вулкане только при обычном шаге дракона', () => {
    const game = new GameManager({
      players,
      startImmediately: false,
      princessAndDragonEnabled: true,
    })
    game.dragonPosition = { rowIndex: 15, tileIndex: 10 }
    game.dragonMove = {
      remainingSteps: 2,
      nextPlayerIndex: 0,
      resumePlayerIndex: 0,
      visited: [{ rowIndex: 15, tileIndex: 10 }],
    }
    game.tilePlacesStats = {
      15: {
        10: fieldTile('old-volcano', 10, true),
        11: fieldTile('new-volcano', 11, true),
        12: fieldTile('next-step', 12),
      },
    }
    game.tilesList = [fieldTile('next-tile', 0)]
    game.playersFollowers[1].ordinaryFollowers = 6
    const point = { x: 11, y: 15, direction: SideName.North }
    game.temporaryObjects.roads.push({
      id: 'road-on-volcano',
      points: [{ ...point, pointType: TileSideType.Road }],
      followers: [{ playerId: 1, objectId: 'road-on-volcano', point }],
    })
    game.placedFollowers.push({
      playerId: 1,
      objectId: 'road-on-volcano',
      point,
    })

    expect(game.moveDragon(15, 11)).toBe(true)

    expect(game.dragonPosition).toEqual({ rowIndex: 15, tileIndex: 11 })
    expect(game.playersFollowers[1].ordinaryFollowers).toBe(7)
    expect(game.placedFollowers).toHaveLength(0)
    expect(game.temporaryObjects.roads[0]?.followers).toHaveLength(0)
  })

  it('телепортация на новый вулкан не снимает подданного со старого тайла', () => {
    const game = new GameManager({
      players,
      startImmediately: false,
      princessAndDragonEnabled: true,
    })
    game.currentPlayer = players[0] ?? null
    game.currentPlayerIndex = 0
    game.dragonPosition = { rowIndex: 15, tileIndex: 10 }
    game.tilePlacesStats = {
      15: { 10: fieldTile('old-volcano', 10, true) },
    }
    game.tilesList = [fieldTile('next-tile', 0)]
    game.playersFollowers[1].ordinaryFollowers = 6
    const point = { x: 10, y: 15, direction: SideName.North }
    game.temporaryObjects.roads.push({
      id: 'road-on-old-volcano',
      points: [{ ...point, pointType: TileSideType.Road }],
      followers: [{ playerId: 1, objectId: 'road-on-old-volcano', point }],
    })
    game.placedFollowers.push({
      playerId: 1,
      objectId: 'road-on-old-volcano',
      point,
    })

    expect(game.placeTile(fieldTile('new-volcano', 11, true), 15, 11)).toBe(
      true
    )

    expect(game.dragonPosition).toEqual({ rowIndex: 15, tileIndex: 11 })
    expect(game.playersFollowers[1].ordinaryFollowers).toBe(6)
    expect(game.placedFollowers).toHaveLength(1)
    expect(game.temporaryObjects.roads[0]?.followers).toHaveLength(1)
  })

  it('не позволяет дракону повторно посещать тот же тайл', () => {
    const game = new GameManager({ players, startImmediately: false })
    game.dragonPosition = { rowIndex: 15, tileIndex: 10 }
    game.dragonMove = {
      remainingSteps: 4,
      nextPlayerIndex: 0,
      resumePlayerIndex: 1,
      visited: [{ rowIndex: 15, tileIndex: 10 }],
    }
    game.tilePlacesStats = {
      15: {
        10: fieldTile('start', 10),
        11: fieldTile('next', 11),
      },
      16: { 11: { ...fieldTile('next-again', 11), y: 16 } },
    }
    game.tilesList = []

    game.currentPlayerIndex = 0
    expect(game.moveDragon(15, 11)).toBe(true)
    expect(game.currentPlayerIndex).toBe(1)
    expect(game.moveDragon(15, 10)).toBe(false)
    expect(game.dragonMove?.visited).toEqual([
      { rowIndex: 15, tileIndex: 10 },
      { rowIndex: 15, tileIndex: 11 },
    ])
  })

  it('начинает движение с игрока, выложившего тайл дракона, и продолжает очередь со следующего', () => {
    const game = new GameManager({ players, startImmediately: false })
    game.currentPlayer = players[0] ?? null
    game.currentPlayerIndex = 0
    game.dragonPosition = { rowIndex: 15, tileIndex: 10 }
    game.tilePlacesStats = {
      15: {
        10: fieldTile('volcano', 10, true),
        11: fieldTile('only-exit', 11),
      },
    }
    game.tilesList = []
    game.pendingDragonMovement = true

    game.endTurn()

    expect(game.dragonMove?.nextPlayerIndex).toBe(0)
    expect(game.dragonMove?.resumePlayerIndex).toBe(1)
    expect(game.currentPlayerIndex).toBe(0)

    expect(game.moveDragon(15, 11)).toBe(true)
    expect(game.dragonMove).toBeUndefined()
    expect(game.currentPlayerIndex).toBe(1)
  })

  it('разрешает шаг на вулкан, но отклоняет невалидные шаги', () => {
    const game = new GameManager({ players, startImmediately: false })
    game.dragonPosition = { rowIndex: 15, tileIndex: 10 }
    game.dragonMove = {
      remainingSteps: 5,
      nextPlayerIndex: 0,
      resumePlayerIndex: 1,
      visited: [
        { rowIndex: 15, tileIndex: 10 },
        { rowIndex: 15, tileIndex: 11 },
      ],
    }
    game.tilePlacesStats = {
      14: { 10: fieldTile('volcano-destination', 10, true) },
      15: {
        10: fieldTile('origin', 10, true),
        11: fieldTile('visited', 11),
      },
      16: {
        10: fieldTile('south', 10),
        11: fieldTile('diagonal', 11),
      },
      13: { 10: fieldTile('next-step', 10) },
    }
    game.currentPlayerIndex = 1

    expect(game.moveDragon(15, 11)).toBe(false)
    expect(game.currentPlayerIndex).toBe(1)
    game.currentPlayerIndex = 0
    expect(game.moveDragon(15, 12)).toBe(false)
    expect(game.moveDragon(15, 9)).toBe(false)
    expect(game.moveDragon(16, 11)).toBe(false)
    expect(game.moveDragon(14, 10)).toBe(true)

    expect(game.dragonPosition).toEqual({ rowIndex: 14, tileIndex: 10 })
    expect(game.dragonMove?.remainingSteps).toBe(4)
    expect(game.currentPlayerIndex).toBe(1)
  })

  it('сохраняет состояние после отказа от невалидных шагов', () => {
    const game = new GameManager({ players, startImmediately: false })
    game.dragonPosition = { rowIndex: 15, tileIndex: 10 }
    game.dragonMove = {
      remainingSteps: 5,
      nextPlayerIndex: 0,
      resumePlayerIndex: 1,
      visited: [
        { rowIndex: 15, tileIndex: 10 },
        { rowIndex: 15, tileIndex: 11 },
      ],
    }
    game.tilePlacesStats = {
      15: {
        10: fieldTile('origin', 10, true),
        11: fieldTile('visited', 11),
      },
      16: {
        10: fieldTile('south', 10),
        11: fieldTile('diagonal', 11),
      },
    }
    game.currentPlayerIndex = 0

    expect(game.moveDragon(15, 12)).toBe(false)
    expect(game.moveDragon(15, 9)).toBe(false)
    expect(game.moveDragon(16, 11)).toBe(false)

    expect(game.dragonPosition).toEqual({ rowIndex: 15, tileIndex: 10 })
    expect(game.dragonMove).toEqual({
      remainingSteps: 5,
      nextPlayerIndex: 0,
      resumePlayerIndex: 1,
      visited: [
        { rowIndex: 15, tileIndex: 10 },
        { rowIndex: 15, tileIndex: 11 },
      ],
    })
    expect(game.currentPlayerIndex).toBe(0)
  })

  it('ограничивает движение шестью шагами и передаёт их игрокам по очереди', () => {
    const threePlayers: Player[] = [
      ...players,
      {
        id: 3,
        name: 'Player 3',
        color: 'coral',
        score: 0,
        socketId: 'socket-3',
        deviceId: 'device-3',
      },
    ]
    const game = new GameManager({
      players: threePlayers,
      startImmediately: false,
    })
    game.dragonPosition = { rowIndex: 15, tileIndex: 10 }
    game.dragonMove = {
      remainingSteps: 6,
      nextPlayerIndex: 0,
      resumePlayerIndex: 1,
      visited: [{ rowIndex: 15, tileIndex: 10 }],
    }
    game.tilePlacesStats = {
      15: Object.fromEntries(
        Array.from({ length: 7 }, (_, index) => [
          index + 10,
          fieldTile(`line-${index}`, index + 10, index === 0),
        ])
      ),
    }
    game.currentPlayerIndex = 0
    game.tilesList = [fieldTile('next-tile', 0)]
    game.availablePlacesTiles = [{ rowIndex: 15, tileIndex: 17, objects: [] }]

    for (let step = 1; step <= 6; step++) {
      expect(game.moveDragon(15, 10 + step)).toBe(true)
      if (step < 6) {
        expect(game.dragonMove?.remainingSteps).toBe(6 - step)
        expect(game.currentPlayerIndex).toBe(step % threePlayers.length)
      }
    }

    expect(game.dragonMove).toBeUndefined()
    expect(game.dragonPosition).toEqual({ rowIndex: 15, tileIndex: 16 })
    expect(game.currentPlayerIndex).toBe(1)
    expect(game.moveDragon(15, 17)).toBe(false)
  })

  it('завершает движение раньше шести шагов в тупике и возобновляет обычный ход', () => {
    const game = new GameManager({ players, startImmediately: false })
    game.dragonPosition = { rowIndex: 15, tileIndex: 10 }
    game.dragonMove = {
      remainingSteps: 6,
      nextPlayerIndex: 0,
      resumePlayerIndex: 1,
      visited: [{ rowIndex: 15, tileIndex: 10 }],
    }
    game.tilePlacesStats = {
      15: {
        10: fieldTile('origin', 10, true),
        11: fieldTile('dead-end', 11),
      },
    }
    game.currentPlayerIndex = 0
    game.tilesList = [fieldTile('next-tile', 0)]
    game.availablePlacesTiles = [{ rowIndex: 14, tileIndex: 10, objects: [] }]

    expect(game.moveDragon(15, 11)).toBe(true)

    expect(game.dragonMove).toBeUndefined()
    expect(game.dragonPosition).toEqual({ rowIndex: 15, tileIndex: 11 })
    expect(game.currentPlayerIndex).toBe(1)
  })

  it('снимает с города выбранную фишку и возвращает её владельцу', () => {
    const game = new GameManager({ players, startImmediately: false })
    game.currentPlayer = players[0] ?? null
    game.currentPlayerIndex = 0
    game.currentTile = null
    game.princessChoice = {
      followers: [
        {
          cityId: 'city-a',
          point: { x: 14, y: 15, direction: SideName.North },
        },
      ],
    }
    game.playersFollowers[2].ordinaryFollowers = 6
    const point = { x: 14, y: 15, direction: SideName.North }
    game.temporaryObjects.cities.push({
      id: 'city-a',
      points: [{ ...point, pointType: TileSideType.City }],
      followers: [{ playerId: 2, objectId: 'city-a', point }],
    })
    game.placedFollowers.push({
      playerId: 2,
      objectId: 'city-a',
      point,
    })

    expect(game.choosePrincessFollower('city-a', { ...point, x: 99 })).toBe(
      false
    )
    expect(game.choosePrincessFollower('city-a', point)).toBe(true)
    expect(game.temporaryObjects.cities[0]?.followers).toHaveLength(0)
    expect(game.playersFollowers[2].ordinaryFollowers).toBe(7)
    expect(game.placedFollowers).toHaveLength(0)
  })

  it('записывает в историю действие принцессы и возврат фишки её владельцу', () => {
    const game = new GameManager({ players, startImmediately: false })
    game.currentPlayer = players[0] ?? null
    game.currentPlayerIndex = 0
    game.currentTile = null
    game.princessChoice = {
      followers: [
        {
          cityId: 'city-a',
          point: { x: 14, y: 15, direction: SideName.North },
        },
      ],
    }
    game.playersFollowers[2].ordinaryFollowers = 6
    const point = { x: 14, y: 15, direction: SideName.North }
    game.temporaryObjects.cities.push({
      id: 'city-a',
      points: [{ ...point, pointType: TileSideType.City }],
      followers: [{ playerId: 2, objectId: 'city-a', point }],
    })
    game.placedFollowers.push({
      playerId: 2,
      objectId: 'city-a',
      point,
    })

    expect(game.choosePrincessFollower('city-a', point)).toBe(true)

    expect(game.actionsHistory.map(({ actionType }) => actionType)).toEqual([
      ActionTypes.PRINCESS_TAKE_FOLLOWER,
      ActionTypes.BACK_FOLLOWER,
    ])
    const princessAction = game.actionsHistory[0]
    expect(
      princessAction?.actionType === ActionTypes.PRINCESS_TAKE_FOLLOWER &&
        princessAction.actionData
    ).toEqual({
      cityId: 'city-a',
      takenFollower: {
        playerId: 2,
        objectId: 'city-a',
        point,
        objectType: ObjectTypes.CITY,
      },
    })
    expect(princessAction?.initiator?.id).toBe(players[0]?.id)
    const backAction = game.actionsHistory[1]
    expect(
      backAction?.actionType === ActionTypes.BACK_FOLLOWER &&
        backAction.actionData.followers
    ).toEqual([
      {
        playerId: 2,
        objectId: 'city-a',
        point,
        objectType: ObjectTypes.CITY,
      },
    ])
  })

  it('не записывает историю, если фишка принцессы уже снята с поля', () => {
    const game = new GameManager({ players, startImmediately: false })
    game.currentPlayer = players[0] ?? null
    game.currentPlayerIndex = 0
    game.currentTile = null
    game.princessChoice = {
      followers: [
        {
          cityId: 'city-a',
          point: { x: 14, y: 15, direction: SideName.North },
        },
      ],
    }
    const point = { x: 14, y: 15, direction: SideName.North }
    game.temporaryObjects.cities.push({
      id: 'city-a',
      points: [{ ...point, pointType: TileSideType.City }],
      followers: [],
    })

    expect(game.choosePrincessFollower('city-a', point)).toBe(false)
    expect(game.actionsHistory).toHaveLength(0)
    expect(game.princessChoice).toBeDefined()
  })
})
