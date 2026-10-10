import { describe, expect, it } from 'vitest'
import { GameManager, type IGameBoard } from '@server/modules/GameManager'
import { serializeGameState } from '@server/modules/gameSave'
import {
  ActionTypes,
  ObjectTypes,
  SideName,
  TileSideType,
} from '@server/modules/types'
import { makePlayers } from '../helpers/fixtures'

const players = makePlayers()

function createGame(): GameManager {
  const game = new GameManager({ players })
  game.id = 'clone-restore-test'
  game.placingPoint = { rowIndex: 14, tileIndex: 15 }
  game.lastUpdate = 123456
  return game
}

function assertIndependentGameState(
  source: IGameBoard,
  copy: IGameBoard
): void {
  const savedSourceBeforeMutation = serializeGameState(source)

  const currentTile = copy.currentTile
  if (!currentTile) throw new Error('Expected a current tile')
  currentTile.sides.north = currentTile.sides.south

  const row = copy.tilePlacesStats[15]
  const startingTile = row?.[15]
  if (!startingTile) throw new Error('Expected the starting tile')
  startingTile.sides[SideName.East] = TileSideType.City

  const tileInDeck = copy.tilesList[0]
  if (!tileInDeck) throw new Error('Expected tiles in the deck')
  tileInDeck.sides[SideName.West] = TileSideType.Road

  const copiedFirstPlayer = copy.players[0]
  if (!copiedFirstPlayer) throw new Error('Expected the first player')
  copiedFirstPlayer.name = 'Changed in clone'

  copy.scores[1] = 99
  copy.gridSize[0] = 99

  expect(serializeGameState(source)).toBe(savedSourceBeforeMutation)
}

describe('Копирование состояния GameManager', () => {
  it('clone сохраняет сериализуемое состояние и не разделяет вложенные данные', () => {
    const game = createGame()
    const clone = game.clone()

    expect(clone).toBeInstanceOf(GameManager)
    expect(serializeGameState(clone)).toBe(serializeGameState(game))
    assertIndependentGameState(game, clone)
  })

  it('restore гидратирует экземпляр и отделяет его от состояния сохранения', () => {
    const game = createGame()
    const savedState = JSON.parse(serializeGameState(game)) as {
      state: IGameBoard
    }
    const restored = GameManager.restore(savedState.state)

    expect(restored).toBeInstanceOf(GameManager)
    expect(serializeGameState(restored)).toBe(serializeGameState(game))
    assertIndependentGameState(savedState.state, restored)
  })
})

describe('Записи истории', () => {
  it('получают текущий номер хода, а финальный подсчёт помечается отдельно', () => {
    const game = new GameManager({ players })
    game.id = 'history-move-numbers'
    game.moveCounter = 3

    game.recordAction({
      actionType: ActionTypes.BACK_FOLLOWER,
      actionData: { followers: [] },
    })

    // Счётчик ходов растёт в конце полного круга: записи следующего хода
    // получают следующий номер, даже если ходили все игроки по очереди.
    game.moveCounter = 4
    game.recordAction({
      actionType: ActionTypes.ADDING_SCORES,
      actionData: {
        objectType: ObjectTypes.ROAD,
        objectData: { id: 'road-1', points: [], followers: [] },
        score: { total: 3, players: { 1: 3 } },
        isFinalScoring: true,
      },
    })

    // Конструктор уже создал запись о стартовом тайле, поэтому сверяем хвост.
    expect(
      game.actionsHistory.slice(-2).map((action) => action.moveNumber)
    ).toEqual([3, 4])
    const finalScoring = game.actionsHistory[game.actionsHistory.length - 1]
    if (finalScoring?.actionType !== ActionTypes.ADDING_SCORES) {
      throw new Error('Expected a final scoring entry')
    }
    expect(finalScoring.actionData.isFinalScoring).toBe(true)
  })
})
