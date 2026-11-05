<template>
  <section v-if="slots.length" class="flex flex-col gap-3">
    <h4 class="text-sm font-semibold uppercase tracking-wide text-text-muted">
      {{ title }}
    </h4>
    <PlayerSlot
      v-for="slot in slots"
      :key="slot.index"
      :player="slot.player"
      :index="slot.index"
      :session-id="sessionId"
      :pending="pending(slot.index)"
      @toggle-checkbox="emit('toggle-checkbox', slot.player, slot.index)"
      @name-input="emit('name-input', $event)"
      @toggle-button="emit('toggle-button', slot.player, slot.index)"
    />
  </section>
</template>

<script setup lang="ts">
import type { PlayerView } from '@server/modules/types'
import PlayerSlot from './PlayerSlot.vue'

withDefaults(
  defineProps<{
    slots: { player: PlayerView; index: number }[]
    title: string
    sessionId: string
    pending: (index: number) => boolean
  }>(),
  { pending: () => false }
)

const emit = defineEmits<{
  'toggle-checkbox': [player: PlayerView, index: number]
  'name-input': [value: string]
  'toggle-button': [player: PlayerView, index: number]
}>()
</script>
