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
  type Player,
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
import { pluralForm } from '@/utils/common'
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
    .filter((player): player is Player => Boolean(player))
)

const leaderLabel = computed(() => {
  const names = leaderPlayers.value
    .map((player) => player.name ?? '')
    .filter((name) => name.length > 0)
  if (names.length === 0) return ''
  if (names.length > 1) return 'Ничья'
  return names[0]
})

const leaderColor = computed(() => {
  if (leaderPlayers.value.length !== 1) return null
  return leaderPlayers.value[0].color ?? null
})

const currentPlayerLabel = computed(() =>
  props.gameBoard.isMyTurn
    ? 'Ваш ход'
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
    socketId: GameService.socketId.value,
    deviceId: GameService.deviceId,
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
  if (props.gameBoard.isMyTurn) return 'Вы'
  return props.gameBoard.currentPlayer?.name ?? '—'
})

const currentTurnNumber = computed(() => getCurrentTurnNumber(props.gameBoard))

const phaseLabel = computed(() => {
  if (props.gameBoard.dragonMove) {
    return isMyTurn.value
      ? 'Выберите, куда шагнуть драконом'
      : `${currentPlayerName.value} двигает дракона`
  }
  if (props.gameBoard.princessChoice) {
    return isMyTurn.value
      ? 'Выберите подданного для принцессы'
      : `${currentPlayerName.value} выбирает подданного`
  }
  if (props.gameBoard.isPlacingFollower) {
    return isMyTurn.value
      ? 'Выставьте подданного или пропустите'
      : `${currentPlayerName.value} выставляет подданного`
  }
  if (props.gameBoard.currentTile) {
    return isMyTurn.value
      ? 'Поставьте тайл на поле'
      : `${currentPlayerName.value} ставит тайл`
  }
  return isMyTurn.value
    ? 'Ваш ход'
    : `${currentPlayerName.value} готовится к ходу`
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
    { label: 'Города', value: breakdown.cities },
    { label: 'Дороги', value: breakdown.roads },
    { label: 'Монастыри', value: breakdown.monasteries },
    { label: 'Сады', value: breakdown.gardens },
    { label: 'Прочее', value: breakdown.other },
  ].filter((entry) => entry.value > 0)

  if (!entries.length) return 'Очки за партию'
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
    return 'Вы'
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
      label: pluralForm(objects.cities, 'город', 'города', 'городов'),
    },
    {
      key: 'roads',
      icon: 'i-lucide-route',
      value: objects.roads,
      label: pluralForm(objects.roads, 'дорога', 'дороги', 'дорог'),
    },
    {
      key: 'monasteries',
      icon: 'i-lucide-church',
      value: objects.monasteries,
      label: pluralForm(
        objects.monasteries,
        'монастырь',
        'монастыря',
        'монастырей'
      ),
    },
    {
      key: 'gardens',
      icon: 'i-lucide-flower-2',
      value: objects.gardens,
      label: pluralForm(objects.gardens, 'сад', 'сада', 'садов'),
    },
  ]
})
</script>
