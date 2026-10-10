import { describe, expect, it, vi } from 'vitest'
import { createSSRApp, h } from 'vue'
import type { Component } from 'vue'
import { renderToString } from 'vue/server-renderer'
import PlayerNameById from '@/components/GameActionsHistory/internal/PlayerNameById.vue'
import BackFollowerAction from '@/components/GameActionsHistory/internal/actions/BackFollowerAction.vue'
import DragonMoveAction from '@/components/GameActionsHistory/internal/actions/DragonMoveAction.vue'
import { ActionTypes, ObjectTypes, TileSideType } from '@server/modules/types'
import type { GameAction } from '@server/modules/GameManager'
import type { Player, ReturnedFollower } from '@server/modules/types'

// Иконка из Nuxt UI тянет рантайм-пакеты, недоступные в node-окружении тестов.
vi.mock('@nuxt/ui/components/Icon.vue', () => ({
  default: { name: 'UIcon', render: () => null },
}))

/**
 * Отображение подданных в истории: у записи всегда видно, чей подданный съеден
 * или возвращён.
 */

const players: Player[] = [
  {
    id: 1,
    name: 'Анна',
    color: 'coral',
    score: 0,
    socketId: null,
    deviceId: null,
  },
  {
    id: 2,
    name: 'Борис',
    color: 'skyblue',
    score: 0,
    socketId: null,
    deviceId: null,
  },
]

const follower = (
  overrides: Partial<ReturnedFollower> = {}
): ReturnedFollower => ({
  playerId: 1,
  objectId: 'city-1',
  point: { x: 15, y: 14, pointType: TileSideType.City },
  objectType: ObjectTypes.CITY,
  ...overrides,
})

const render = (component: Component, props: Record<string, unknown>) =>
  renderToString(createSSRApp({ render: () => h(component, props) }))

// Текст без разметки: комментарии и теги рендера разбивают соседние узлы.
const textOf = (html: string) =>
  html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()

const backFollowerAction: GameAction = {
  actionType: ActionTypes.BACK_FOLLOWER,
  actionData: { followers: [follower()] },
}

const dragonMoveAction: GameAction = {
  actionType: ActionTypes.DRAGON_MOVE,
  actionData: {
    from: { rowIndex: 15, tileIndex: 13 },
    to: { rowIndex: 15, tileIndex: 14 },
    eatenFollowers: [follower()],
    remainingSteps: 0,
  },
}

describe('имя игрока в истории', () => {
  it('выводится, если у компонента нет продолжения', async () => {
    const html = await render(PlayerNameById, { players, playerId: 1 })

    expect(textOf(html)).toBe('Анна')
  })

  it('выводится перед продолжением, переданным слотом', async () => {
    const html = await renderToString(
      createSSRApp({
        render: () =>
          h(
            PlayerNameById,
            { players, playerId: 2 },
            { default: () => ' — рыцарь' }
          ),
      })
    )

    expect(textOf(html)).toBe('Борис — рыцарь')
  })

  it('выводится в записи о возврате подданных', async () => {
    const html = await render(BackFollowerAction, {
      action: backFollowerAction,
      players,
    })

    expect(textOf(html)).toMatch(/Возврат подданных\.\s*Анна — рыцарь/)
  })

  it('выводится в записи о шаге дракона', async () => {
    const html = await render(DragonMoveAction, {
      action: dragonMoveAction,
      players,
    })

    expect(textOf(html)).toMatch(/Съедены подданные:\s*Анна — рыцарь/)
  })
})
