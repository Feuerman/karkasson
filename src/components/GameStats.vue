<template>
  <div class="panel-parchment w-[300px] overflow-hidden text-text shadow-card">
    <div
      class="relative flex items-center justify-center gap-2 border-b-2 px-3 py-2.5"
      :class="[
        playerBackgroundColorClass(headerColor),
        isMyTurn ? 'border-gold-dark' : 'border-transparent',
      ]"
    >
      <UIcon
        :name="gameBoard.gameIsEnded ? 'i-lucide-crown' : 'i-lucide-footprints'"
        class="h-5 w-5 text-black/70"
      />
      <span
        :title="gameBoard.gameIsEnded ? leaderLabel : currentPlayerLabel"
        :data-testid="TEST_IDS.gameStatsCurrentPlayer"
        class="title-medieval min-w-0 truncate text-lg leading-none font-bold text-black"
      >
        {{ gameBoard.gameIsEnded ? leaderLabel : currentPlayerLabel }}
      </span>
      <span
        v-if="isMyTurn"
        :data-testid="TEST_IDS.gameStatsTurnBadge"
        class="stats-turn-pulse ml-1 h-2.5 w-2.5 shrink-0 rounded-full bg-white shadow-soft"
        aria-hidden="true"
      ></span>
      <PanelCollapseButton
        panel-id="player-stats"
        :collapsed="collapsed"
        class="absolute right-1 top-1/2 -translate-y-1/2"
        @toggle="toggle"
      />
    </div>

    <div v-show="!collapsed">
      <div class="divide-y divide-border/70 px-2 py-1">
        <div
          v-for="entry in rankedPlayers"
          :key="entry.player.id"
          :data-testid="entry.isMe ? TEST_IDS.gameStatsOwnPlayer : undefined"
          class="flex items-center gap-3 px-2 py-2.5"
          :class="
            entry.isMe
              ? 'rounded-lg bg-gold/15 shadow-[inset_0_0_0_1px_rgba(163,124,44,0.35)]'
              : ''
          "
        >
          <span
            class="h-3 w-3 shrink-0 rounded-full ring-1 ring-black/20"
            :class="playerBackgroundColorClass(entry.player.color)"
          ></span>
          <span
            :title="entry.player.name ?? ''"
            class="min-w-0 flex-1 truncate text-[1.05rem] font-semibold text-text"
          >
            <span class="mr-1">{{ entry.player.name }}</span>
            <UIcon
              v-if="entry.isLeader"
              name="i-lucide-crown"
              class="inline h-4 w-4 align-[-1px] text-gold-dark"
              title="Лидер по очкам"
              aria-label="Лидер по очкам"
            />
            <span
              v-if="entry.isMe"
              class="ml-1 rounded bg-gold/30 px-1 text-[.7rem] font-bold tracking-wide text-wood-dark uppercase"
            >
              Вы
            </span>
          </span>
          <span
            class="flex shrink-0 items-center gap-1.5 text-[.85rem] tabular-nums"
          >
            <span
              :title="`${gameBoard.playersFollowers[entry.player.id].ordinaryFollowers} подданных в запасе`"
              class="flex items-center gap-1"
            >
              <span
                class="inline-block h-2.5 w-2.5 rounded-[3px] border border-black/25"
                :class="playerBackgroundColorClass(entry.player.color)"
              />
              {{
                gameBoard.playersFollowers[entry.player.id].ordinaryFollowers
              }}
            </span>
            <span
              v-if="
                gameBoard.playersFollowers[entry.player.id].bigFollowers !==
                undefined
              "
              class="flex items-center gap-1"
              :title="`${gameBoard.playersFollowers[entry.player.id].bigFollowers ?? 0} больших подданных в запасе`"
            >
              <UIcon
                name="i-lucide-users-round"
                class="h-4 w-4 text-gold-dark"
              />
              {{
                gameBoard.playersFollowers[entry.player.id].bigFollowers ?? 0
              }}
            </span>
            <UIcon
              name="i-lucide-church"
              class="ml-0.5 h-4 w-4"
              :class="
                gameBoard.playersFollowers[entry.player.id].monks > 0
                  ? 'text-gold-dark'
                  : 'text-text-muted/40'
              "
              :title="
                gameBoard.playersFollowers[entry.player.id].monks > 0
                  ? 'Аббат в запасе'
                  : 'Аббат на поле'
              "
            />
          </span>
          <span class="text-[1.1rem] font-bold tabular-nums text-text">
            {{ entry.score }}
          </span>
        </div>
      </div>

      <div class="mx-3 border-t border-gold-dark/40 py-2.5">
        <div class="flex items-center justify-between gap-2">
          <span
            class="flex items-center gap-1.5 text-sm font-semibold text-wood"
          >
            <UIcon name="i-lucide-hourglass" class="h-4 w-4 text-gold-dark" />
            Ход
          </span>
          <span
            :data-testid="TEST_IDS.gameStatsTurnTimer"
            class="text-sm font-semibold tabular-nums text-wood-dark"
          >
            {{ turnDuration }}
          </span>
        </div>
        <div class="mt-1.5 flex items-center justify-between gap-2 text-sm">
          <span class="min-w-0 truncate text-text-muted">
            Ходит:
            <span class="font-semibold text-wood">{{ currentPlayerName }}</span>
          </span>
          <span
            v-if="isComputerTurn"
            :data-testid="TEST_IDS.gameStatsComputerThinking"
            class="flex shrink-0 items-center gap-1.5 text-xs text-text-muted"
          >
            <span
              class="stats-thinking-dot h-2 w-2 rounded-full bg-gold-dark"
              aria-hidden="true"
            ></span>
            думает
          </span>
        </div>
        <div v-if="nextPlayerName" class="mt-1 text-sm text-text-muted">
          Далее:
          <span class="font-semibold text-wood">{{ nextPlayerName }}</span>
        </div>
      </div>

      <div class="mx-3 border-t border-gold-dark/40 py-2.5">
        <div class="flex items-center justify-between">
          <span class="flex items-center gap-2 text-sm font-semibold text-wood">
            <UIcon name="i-lucide-layers" class="h-4 w-4 text-gold-dark" />
            Прогресс
          </span>
          <span
            :data-testid="TEST_IDS.gameStatsTilesProgress"
            class="text-sm font-semibold tabular-nums text-wood-dark"
          >
            {{ progress.placedTiles }} / {{ progress.totalTiles }}
          </span>
        </div>
        <div class="mt-2 h-2 w-full overflow-hidden rounded-full bg-track">
          <div
            :data-testid="TEST_IDS.gameStatsTilesProgressBar"
            class="h-full rounded-full bg-gold-dark"
            :style="{ width: `${tilesProgressPercent}%` }"
          ></div>
        </div>
        <p class="mt-1.5 text-xs text-text-muted">
          В колоде: {{ progress.remainingTiles }}
        </p>
        <div
          class="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-text-muted"
        >
          <span
            v-for="object in objectSummaries"
            :key="object.key"
            class="flex items-center gap-1"
          >
            <UIcon :name="object.icon" class="h-3.5 w-3.5 shrink-0" />
            <span class="font-semibold tabular-nums text-wood">
              {{ object.value }}
            </span>
            {{ object.label }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import UIcon from '@nuxt/ui/components/Icon.vue'
import PanelCollapseButton from '@/components/PanelCollapseButton.vue'
import type { IGameBoard } from '@/types/game'
import type { Player } from '@server/modules/types'
import { TEST_IDS } from '@/data/testIds'
import { playerBackgroundColorClass } from '@/utils/colors'
import { buildGameProgress, progressPercent } from '@/utils/gameProgress'
import {
  findOwnPlayer,
  getNextPlayer,
  isComputerPlayer,
  rankPlayers,
} from '@/utils/players'
import { pluralForm } from '@/utils/common'
import { formatDuration } from '@/utils/time'
import { useTurnTimer } from '@/composables/useTurnTimer'
import { usePanelCollapse } from '@/composables/usePanelCollapse'
import GameService from '@/modules/GameService'

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
  return props.gameBoard.gameIsEnded
    ? leaderColor.value
    : props.gameBoard.currentPlayer?.color
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
