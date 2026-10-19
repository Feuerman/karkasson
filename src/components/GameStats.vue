<template>
  <div class="panel-parchment w-[300px] overflow-hidden text-text shadow-card">
    <div
      class="flex items-center justify-center gap-2 border-b-2 px-3 py-2.5"
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
    </div>

    <div class="divide-y divide-border/70 px-2 py-1">
      <div
        v-for="player in [...gameBoard.players]"
        :key="player.id"
        class="flex items-center gap-3 px-2 py-2.5"
      >
        <span
          class="h-3 w-3 shrink-0 rounded-full ring-1 ring-black/20"
          :class="playerBackgroundColorClass(player.color)"
        ></span>
        <span
          :title="player.name ?? ''"
          class="min-w-0 flex-1 truncate text-[1.05rem] font-semibold text-text"
        >
          {{ player.name }}
        </span>
        <span
          class="flex shrink-0 items-center gap-1.5 text-[.85rem] tabular-nums"
        >
          <span
            :title="`${gameBoard.playersFollowers[player.id].ordinaryFollowers} подданных в запасе`"
            class="flex items-center gap-1"
          >
            <span
              class="inline-block h-2.5 w-2.5 rounded-[3px] border border-black/25"
              :class="playerBackgroundColorClass(player.color)"
            />
            {{ gameBoard.playersFollowers[player.id].ordinaryFollowers }}
          </span>
          <span
            v-if="
              gameBoard.playersFollowers[player.id].bigFollowers !== undefined
            "
            class="flex items-center gap-1"
            :title="`${gameBoard.playersFollowers[player.id].bigFollowers ?? 0} больших подданных в запасе`"
          >
            <UIcon name="i-lucide-users-round" class="h-4 w-4 text-gold-dark" />
            {{ gameBoard.playersFollowers[player.id].bigFollowers ?? 0 }}
          </span>
          <UIcon
            name="i-lucide-church"
            class="ml-0.5 h-4 w-4"
            :class="
              gameBoard.playersFollowers[player.id].monks > 0
                ? 'text-gold-dark'
                : 'text-text-muted/40'
            "
            :title="
              gameBoard.playersFollowers[player.id].monks > 0
                ? 'Аббат в запасе'
                : 'Аббат на поле'
            "
          />
        </span>
        <span class="text-[1.1rem] font-bold tabular-nums text-text">
          {{ gameBoard.scores[player.id] }}
        </span>
      </div>
    </div>
    <div
      v-if="gameBoard.tilesList.length"
      class="mx-3 border-t border-gold-dark/40 py-2.5"
    >
      <div
        class="flex items-center justify-between rounded-lg border border-gold-dark/35 bg-gold/15 px-3 py-2"
      >
        <span class="flex items-center gap-2 text-sm font-semibold text-wood">
          <UIcon name="i-lucide-layers" class="h-4 w-4 text-gold-dark" />
          Тайлов в колоде
        </span>
        <span
          class="rounded-md bg-gold/30 px-2 py-0.5 text-base font-bold tabular-nums text-wood-dark"
        >
          {{ gameBoard.tilesList.length }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import UIcon from '@nuxt/ui/components/Icon.vue'
import type { IGameBoard } from '@/types/game'
import type { Player } from '@server/modules/types'
import { TEST_IDS } from '@/data/testIds'
import { playerBackgroundColorClass } from '@/utils/colors'

const props = defineProps<{
  gameBoard: IGameBoard
}>()

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
</script>
