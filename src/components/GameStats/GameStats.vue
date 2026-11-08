<template>
  <div class="panel-parchment w-[300px] overflow-hidden text-text shadow-card">
    <GameStatsHeader
      :game-board="gameBoard"
      :current-player-label="currentPlayerLabel"
      :is-my-turn="isMyTurn"
      :current-turn-number="currentTurnNumber"
      :phase-label="phaseLabel"
      :is-computer-turn="isComputerTurn"
      :header-color="headerColor"
      :collapsed="collapsed"
      :toggle="toggle"
      :leader-label="leaderLabel"
    />

    <div v-show="!collapsed">
      <div class="divide-y divide-border/70 px-2 py-1">
        <GameStatsPlayerRow
          v-for="row in playerRows"
          :key="row.player.id"
          :entry="row"
          :game-board="gameBoard"
          :score-changed="row.scoreChanged"
          :turn-score="row.turnScore"
          :score-breakdown-title="row.scoreBreakdownTitle"
        />
      </div>

      <GameStatsTurnInfo
        :turn-duration="turnDuration"
        :current-player-name="currentPlayerName"
        :is-computer-turn="isComputerTurn"
        :next-player-name="nextPlayerName"
        :turn-order="turnOrder"
        :game-is-ended="gameBoard.gameIsEnded"
      />

      <GameStatsProgress
        :progress="progress"
        :tiles-progress-percent="tilesProgressPercent"
        :object-summaries="objectSummaries"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { IGameBoard } from '@/types/game'
import {
  ActionTypes,
  type FollowerCount,
  type PlayerView,
  type PlayerId,
} from '@server/modules/types'
import { getCurrentTurnNumber } from '@/utils/turnNumber'
import { buildGameProgress, progressPercent } from '@/utils/gameProgress'
import { buildScoreBreakdown } from '@/utils/gameResults'
import {
  findOwnPlayer,
  getNextPlayer,
  isComputerPlayer,
  rankPlayers,
  type RankedPlayer,
} from '@/utils/players'
import { plural, t } from '@/utils/i18n'
import { formatDuration } from '@/utils/time'
import { useTurnTimer } from '@/composables/useTurnTimer'
import { usePanelCollapse } from '@/composables/usePanelCollapse'
import GameService from '@/modules/GameService'
import GameStatsHeader from './internal/GameStatsHeader.vue'
import GameStatsPlayerRow from './internal/GameStatsPlayerRow.vue'
import GameStatsTurnInfo from './internal/GameStatsTurnInfo.vue'
import GameStatsProgress from './internal/GameStatsProgress.vue'

const props = defineProps<{
  gameBoard: IGameBoard
}>()

/**
 * Панель партии на узком экране мешает доске, поэтому окно сворачивается
 * само. Игрок может развернуть его кнопкой в шапке.
 */
const { collapsed, toggle } = usePanelCollapse('player-stats', {
  autoCollapseOnNarrow: true,
})

/**
 * Победителя считает сервер и присылает списком лидеров. Клиент только
 * показывает их: пересчёт по индексу массива показывал чужое имя, если у
 * игрока не было записи в счёте.
 *
 * id приходит ключом объекта, поэтому он всегда строка, а у игрока число —
 * сравниваем по строковой форме.
 */
const leaderPlayerIds = computed(() => props.gameBoard.winnerPlayerIds ?? [])

const leaderPlayers = computed(() =>
  leaderPlayerIds.value
    .map((id) =>
      props.gameBoard.players.find((p) => String(p.id) === String(id))
    )
    .filter((player): player is PlayerView => Boolean(player))
)

const leaderLabel = computed(() => {
  const names = leaderPlayers.value
    .map((player) => player.name ?? '')
    .filter((name) => name.length > 0)
  if (names.length === 0) return ''
  if (names.length > 1) return t('stats_draw')
  return names[0]
})

const leaderColor = computed(() => {
  if (leaderPlayers.value.length !== 1) return null
  return leaderPlayers.value[0].color ?? null
})

const currentPlayerLabel = computed(() =>
  props.gameBoard.isMyTurn
    ? t('ui_your_turn')
    : (props.gameBoard.currentPlayer?.name ?? '')
)

/** Ход игрока: шапка панели отмечается, чтобы пропущенный ход был заметен. */
const isMyTurn = computed(
  () => props.gameBoard.isMyTurn && !props.gameBoard.gameIsEnded
)

const headerColor = computed(() => {
  if (props.gameBoard.gameIsEnded) return leaderColor.value
  return props.gameBoard.currentPlayer?.color ?? null
})

/** Игрок, за которым сидит текущий браузер. */
const ownPlayer = computed(() =>
  findOwnPlayer(props.gameBoard.players ?? [], {
    sessionId: GameService.sessionId.value,
  })
)

/** Таблица счёта: игроки по убыванию очков, лидер и «я» помечены. */
const rankedPlayers = computed(() =>
  rankPlayers(
    props.gameBoard.players ?? [],
    props.gameBoard.scores,
    ownPlayer.value?.id
  )
)

/** Ходит компьютер: пауза между его ходами не выглядит зависанием. */
const isComputerTurn = computed(
  () =>
    !props.gameBoard.isMyTurn &&
    !props.gameBoard.gameIsEnded &&
    isComputerPlayer(props.gameBoard.currentPlayer)
)

const currentPlayerName = computed(() => {
  if (props.gameBoard.isMyTurn) return t('stats_you')
  return props.gameBoard.currentPlayer?.name ?? '—'
})

const currentTurnNumber = computed(() => getCurrentTurnNumber(props.gameBoard))

const phaseLabel = computed(() => {
  if (props.gameBoard.dragonMove) {
    return isMyTurn.value
      ? t('phase_dragon_own')
      : t('phase_dragon_other', { name: currentPlayerName.value })
  }
  if (props.gameBoard.princessChoice) {
    return isMyTurn.value
      ? t('phase_princess_own')
      : t('phase_princess_other', { name: currentPlayerName.value })
  }
  if (props.gameBoard.isPlacingFollower) {
    return isMyTurn.value
      ? t('phase_follower_own')
      : t('phase_follower_other', { name: currentPlayerName.value })
  }
  if (props.gameBoard.currentTile) {
    return isMyTurn.value
      ? t('phase_tile_own')
      : t('phase_tile_other', { name: currentPlayerName.value })
  }
  return isMyTurn.value
    ? t('phase_waiting_own')
    : t('phase_waiting_other', { name: currentPlayerName.value })
})

const turnScores = computed(() => {
  const scores = new Map<string, number>()

  for (const action of props.gameBoard.actionsHistory ?? []) {
    if (action.actionType !== ActionTypes.ADDING_SCORES) continue
    if (action.actionData.isFinalScoring) continue
    if (action.turnNumber !== currentTurnNumber.value) continue

    for (const [playerId, points] of Object.entries(
      action.actionData.score.players ?? {}
    )) {
      if (typeof points !== 'number' || points === 0) continue
      scores.set(String(playerId), (scores.get(String(playerId)) ?? 0) + points)
    }
  }

  return scores
})

const turnScore = (playerId: PlayerId): number =>
  turnScores.value.get(String(playerId)) ?? 0

const scoreBreakdownTitle = (playerId: PlayerId): string => {
  const breakdown = buildScoreBreakdown(
    props.gameBoard.actionsHistory,
    playerId
  )
  const entries = [
    {
      get label() {
        return t('breakdown_cities')
      },
      value: breakdown.cities,
    },
    {
      get label() {
        return t('breakdown_roads')
      },
      value: breakdown.roads,
    },
    {
      get label() {
        return t('breakdown_monasteries')
      },
      value: breakdown.monasteries,
    },
    {
      get label() {
        return t('breakdown_gardens')
      },
      value: breakdown.gardens,
    },
    {
      get label() {
        return t('breakdown_fields')
      },
      value: breakdown.fields,
    },
    {
      get label() {
        return t('breakdown_other')
      },
      value: breakdown.other,
    },
  ].filter((entry) => entry.value > 0)

  if (!entries.length) return t('stats_game_points')
  return entries.map((entry) => `${entry.label}: ${entry.value}`).join(' · ')
}

const changedScoreIds = ref<Set<string>>(new Set())
let scoreResetTimer: ReturnType<typeof setTimeout> | undefined

watch(
  () => props.gameBoard.scores,
  (nextScores, previousScores) => {
    if (!previousScores) return

    const changed = new Set<string>()
    for (const [playerId, score] of Object.entries(nextScores ?? {})) {
      if ((previousScores[playerId] ?? 0) !== score)
        changed.add(String(playerId))
    }
    if (!changed.size) return

    changedScoreIds.value = changed
    if (scoreResetTimer) clearTimeout(scoreResetTimer)
    scoreResetTimer = setTimeout(() => {
      changedScoreIds.value = new Set()
    }, 1800)
  },
  { deep: true }
)

const hasScoreChanged = (playerId: PlayerId): boolean =>
  changedScoreIds.value.has(String(playerId))

onBeforeUnmount(() => {
  if (scoreResetTimer) clearTimeout(scoreResetTimer)
})

/** Кто ходит следующим: порядок ходов задаёт сервер. */
const nextPlayerName = computed(() => {
  if (props.gameBoard.gameIsEnded) return ''

  const next = getNextPlayer(
    props.gameBoard.players ?? [],
    props.gameBoard.currentPlayerIndex
  )
  if (!next) return ''
  if (ownPlayer.value && String(next.id) === String(ownPlayer.value.id)) {
    return t('stats_you')
  }
  return next.name ?? ''
})

/** Очередь ходов: сервер задаёт текущего игрока, остальные идут по кругу. */
const turnOrder = computed(() => {
  const players = props.gameBoard.players ?? []
  if (!players.length) return []
  const index = props.gameBoard.currentPlayerIndex
  const start = index >= 0 && index < players.length ? index : 0
  return [...players.slice(start), ...players.slice(0, start)]
})

/** Строка игрока с подпиткой данных followers/очков для подкомпонента строки. */
interface GameStatsRow extends RankedPlayer {
  followers: FollowerCount
  scoreChanged: boolean
  turnScore: number
  scoreBreakdownTitle: string
}

const playerRows = computed<GameStatsRow[]>(() =>
  rankedPlayers.value.map((entry) => {
    return {
      ...entry,
      followers: props.gameBoard.playersFollowers[entry.player.id] ?? {
        ordinaryFollowers: 0,
        bigFollowers: 0,
        monks: 0,
      },
      scoreChanged: hasScoreChanged(entry.player.id),
      turnScore: turnScore(entry.player.id),
      scoreBreakdownTitle: scoreBreakdownTitle(entry.player.id),
    }
  })
)

/** Смена хода: с её началом отсчёт времени идёт заново. */
const turnKey = computed(
  () => `${props.gameBoard.id ?? ''}:${props.gameBoard.currentPlayer?.id ?? ''}`
)

const { elapsedSeconds } = useTurnTimer(turnKey)

const turnDuration = computed(() => formatDuration(elapsedSeconds.value))

/** Ход партии в числах: плитки и объекты. */
const progress = computed(() => buildGameProgress(props.gameBoard))

const tilesProgressPercent = computed(() => progressPercent(progress.value))

/** Объекты на доске: сколько городов, дорог, монастырей и садов. */
const objectSummaries = computed(() => {
  const objects = progress.value.objects

  return [
    {
      key: 'cities',
      icon: 'i-lucide-castle',
      value: objects.cities,
      label: plural(objects.cities, {
        one: t('stats_city_one'),
        two: t('stats_city_two'),
        five: t('stats_city_five'),
        other: t('stats_cities'),
      }),
    },
    {
      key: 'roads',
      icon: 'i-lucide-route',
      value: objects.roads,
      label: plural(objects.roads, {
        one: t('stats_road_one'),
        two: t('stats_road_two'),
        five: t('stats_road_five'),
        other: t('stats_roads'),
      }),
    },
    {
      key: 'monasteries',
      icon: 'i-lucide-church',
      value: objects.monasteries,
      label: plural(objects.monasteries, {
        one: t('stats_monastery_one'),
        two: t('stats_monastery_two'),
        five: t('stats_monastery_five'),
        other: t('stats_monasteries'),
      }),
    },
    {
      key: 'gardens',
      icon: 'i-lucide-flower-2',
      value: objects.gardens,
      label: plural(objects.gardens, {
        one: t('stats_garden_one'),
        two: t('stats_garden_two'),
        five: t('stats_garden_five'),
        other: t('stats_gardens'),
      }),
    },
  ]
})
</script>
