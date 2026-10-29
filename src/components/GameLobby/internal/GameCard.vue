<template>
  <div
    class="group flex cursor-pointer flex-col gap-3 rounded-card border border-secondary-dark/30 bg-gradient-to-br from-tertiary-soft to-tertiary p-4 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:border-secondary/70 hover:shadow-card sm:flex-row sm:items-center sm:justify-between"
  >
    <div class="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      <div class="flex items-center gap-2 text-text-surface-light">
        <UIcon name="i-lucide-flag" class="h-[18px] w-[18px] text-secondary" />
        <span class="title-medieval text-base tracking-wide">
          Партия «{{ lobbyName }}»
        </span>
      </div>

      <button
        type="button"
        class="cursor-pointer rounded-md border border-secondary/40 bg-secondary/10 px-2 py-0.5 font-mono text-sm tracking-widest text-secondary transition-colors hover:bg-secondary/25"
        :aria-label="`Скопировать номер комнаты ${game.roomCode}`"
        :title="copied ? 'Номер скопирован' : 'Скопировать номер комнаты'"
        :data-testid="TEST_IDS.lobbyCardCopyRoomCode"
        @click.stop="copyRoomCode"
      >
        № {{ game.roomCode }}
      </button>

      <span
        v-if="copied"
        class="rounded-pill border border-secondary/50 bg-secondary/15 px-2 py-0.5 text-caption text-secondary"
      >
        Скопировано
      </span>

      <span
        v-if="game.isLastGame"
        class="flex items-center gap-1 rounded-pill border border-secondary/50 bg-secondary/15 px-2 py-0.5 text-caption uppercase tracking-wide text-secondary"
      >
        <UIcon name="i-lucide-history" class="h-3.5 w-3.5" />
        Последняя
      </span>

      <div class="flex items-center gap-1.5 text-body text-surface">
        <UIcon name="i-lucide-users" class="h-[18px] w-[18px] text-secondary" />
        {{ game.players?.length }}
      </div>

      <span
        class="flex items-center gap-1.5 text-sm text-text-surface"
        :title="`Обновлено ${updatedText}`"
        data-testid="lobbyCardUpdated"
      >
        <UIcon name="i-lucide-clock" class="h-4 w-4 text-secondary" />
        {{ updatedText }}
      </span>

      <GameStatus :game="game" />
      <span
        v-if="game.rules?.expansions.innsAndCathedrals"
        class="rounded-pill border border-secondary/50 bg-secondary/15 px-2 py-0.5 text-caption text-secondary"
      >
        Таверны и соборы
      </span>
      <span
        v-if="game.rules?.expansions.river"
        class="rounded-pill border border-secondary/50 bg-secondary/15 px-2 py-0.5 text-caption text-secondary"
      >
        Река
      </span>
      <span
        v-if="game.rules?.expansions.princessAndDragon"
        class="rounded-pill border border-secondary/50 bg-secondary/15 px-2 py-0.5 text-caption text-secondary"
        data-testid="lobbyCardPrincessDragon"
      >
        Принцесса и дракон
      </span>
    </div>

    <div
      v-if="game.gameIsStarted"
      class="flex flex-wrap gap-x-4 gap-y-0.5 text-body text-text-surface-light"
    >
      <span
        v-for="row in scoreRows"
        :key="row.player.id"
        class="flex items-center gap-1.5 whitespace-nowrap"
      >
        <span
          class="h-2.5 w-2.5 rounded-full ring-1 ring-black/30"
          :class="playerBackgroundColorClass(row.player.color)"
        ></span>
        <template
          v-if="!row.player.socketId && !row.player.deviceId && row.player.name"
        >
          AI
        </template>
        {{ row.player.name }} — {{ row.score }}
      </span>
    </div>

    <UButton
      class="flex min-h-11 w-full shrink-0 cursor-pointer items-center justify-center gap-2 border border-secondary-dark/60 bg-secondary/15 text-center text-body leading-tight font-semibold text-text-bright hover:bg-secondary/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary sm:w-[180px]"
      color="neutral"
      :loading="pending"
      @click="onJoin"
    >
      <template #leading>
        <UIcon
          :name="joinButtonIcon(game)"
          class="h-[18px] w-[18px]"
          :class="pending ? 'invisible' : ''"
        />
      </template>
      {{ joinButtonLabel(game) }}
    </UButton>
  </div>
</template>

<script setup lang="ts">
import UIcon from '@nuxt/ui/components/Icon.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import { computed } from 'vue'
import type { LobbyGame } from '@/types/game'
import { playerBackgroundColorClass } from '@/utils/colors'
import { useCopyToClipboard } from '@/composables/useCopyToClipboard'
import { formatRelativeTime } from '@/utils/time'
import { TEST_IDS } from '@/data/testIds'
import GameStatus from './GameStatus.vue'
import { isRejoinable, joinButtonIcon, joinButtonLabel } from './helpers'

const props = withDefaults(
  defineProps<{
    game: LobbyGame
    deviceId: string
    /** Команда входа или переподключения ожидает ответа сервера. */
    pending?: boolean
  }>(),
  { pending: false }
)

const lobbyName = computed(
  () => props.game.players.find((player) => player.name)?.name ?? 'Каркассон'
)

/** Давность партии: видно, какая комната живая. */
const updatedText = computed(() =>
  formatRelativeTime(props.game.lastUpdate ?? 0)
)

const { copied, copy: copyToClipboardFn } = useCopyToClipboard()

const copyRoomCode = async () => {
  await copyToClipboardFn(props.game.roomCode)
}

/**
 * Счёт — запись по id игрока, а не по позиции в массиве, поэтому игрока ищем
 * по id: при нулевом счёте у кого-то из участников порядок ключей расходился с
 * порядком `players` и карточка показывала чужое имя. Ключ объекта всегда
 * строка, поэтому сравниваем по строковой форме id.
 */
const scoreRows = computed(() =>
  Object.entries(props.game.scores ?? {}).flatMap(([playerId, score]) => {
    const player = props.game.players.find(
      (candidate) => String(candidate.id) === playerId
    )
    return player ? [{ player, score }] : []
  })
)

const emit = defineEmits<{
  join: [gameId: string]
  rejoin: [gameId: string]
}>()

const onJoin = () => {
  if (!props.game.id || props.pending) return
  if (isRejoinable(props.game, props.deviceId)) {
    emit('rejoin', props.game.id)
  } else {
    emit('join', props.game.id)
  }
}
</script>
