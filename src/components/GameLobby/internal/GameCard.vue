<template>
  <div
    class="group flex cursor-pointer flex-col gap-3 rounded-xl border border-gold-dark/30 bg-gradient-to-br from-wood to-wood-dark p-4 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:border-gold/70 hover:shadow-card sm:flex-row sm:items-center sm:justify-between"
  >
    <div class="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      <div class="flex items-center gap-2 text-[#f3e7c8]">
        <UIcon name="i-lucide-flag" class="h-[18px] w-[18px] text-gold" />
        <span class="title-medieval text-base tracking-wide">
          Партия «{{ lobbyName }}»
        </span>
      </div>

      <span
        class="rounded-md border border-gold/40 bg-gold/10 px-2 py-0.5 font-mono text-sm tracking-widest text-gold"
        :aria-label="`Номер комнаты ${game.roomCode}`"
      >
        № {{ game.roomCode }}
      </span>

      <span
        v-if="game.isLastGame"
        class="flex items-center gap-1 rounded-full border border-gold/50 bg-gold/15 px-2 py-0.5 text-xs uppercase tracking-wide text-gold"
      >
        <UIcon name="i-lucide-history" class="h-3.5 w-3.5" />
        Последняя
      </span>

      <div class="flex items-center gap-1.5 text-[1.05rem] text-[#d9c9a3]">
        <UIcon name="i-lucide-users" class="h-[18px] w-[18px] text-gold" />
        {{ game.players?.length }}
      </div>

      <GameStatus :game="game" />
      <span
        v-if="game.rules?.expansions.innsAndCathedrals"
        class="rounded-full border border-gold/50 bg-gold/15 px-2 py-0.5 text-xs text-gold"
      >
        Таверны и соборы
      </span>
      <span
        v-if="game.rules?.expansions.river"
        class="rounded-full border border-gold/50 bg-gold/15 px-2 py-0.5 text-xs text-gold"
      >
        Река
      </span>
    </div>

    <div
      v-if="game.gameIsStarted"
      class="flex flex-wrap gap-x-4 gap-y-0.5 text-[1.05rem] text-[#e8d9b0]"
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
      class="flex min-h-11 w-full shrink-0 cursor-pointer items-center justify-center gap-2 border border-gold-dark/60 bg-gold/15 text-center text-base leading-tight font-semibold text-[#fff2d2] hover:bg-gold/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold sm:w-[180px]"
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
import GameStatus from './GameStatus.vue'
import { isRejoinable, joinButtonIcon, joinButtonLabel } from './helpers'

const props = withDefaults(
  defineProps<{
    game: LobbyGame
    deviceId: string
    /** Команта входа или переподключения ожидает ответа сервера. */
    pending?: boolean
  }>(),
  { pending: false }
)

const lobbyName = computed(
  () => props.game.players.find((player) => player.name)?.name ?? 'Каркассон'
)

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
