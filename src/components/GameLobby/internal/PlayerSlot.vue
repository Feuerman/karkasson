<template>
  <div
    class="flex items-center gap-3 rounded-xl border border-border bg-surface/70 py-2 pl-3 pr-4 shadow-soft"
  >
    <UCheckbox
      :class="playerTextColorClass(player.color)"
      :model-value="Boolean(player.name)"
      :disabled="checkboxDisabled"
      @update:model-value="emit('toggleCheckbox', player, index)"
    />

    <UInput
      :model-value="player.name ?? ''"
      :placeholder="`Игрок ${index + 1}`"
      :disabled="Boolean(player.socketId || !player.name)"
      :ui="{
        input:
          'border-2 text-lg ' +
          playerBorderColorClass(player.name ? player.color : null),
      }"
      class="flex-1 rounded-lg bg-transparent font-semibold text-text"
      @update:model-value="emit('nameInput', $event)"
    />
    <div
      v-if="!player.socketId && player.name"
      class="text-base font-semibold text-text-muted"
    >
      ИИ
    </div>
    <UButton
      variant="outline"
      color="neutral"
      :class="[
        'flex h-10 w-[150px] shrink-0 items-center justify-center whitespace-nowrap px-4 text-base font-semibold text-text',
        canToggle ? '' : 'invisible',
      ]"
      :ui="{
        base:
          'border-2 ' +
          playerBorderColorClass(player.name ? player.color : null),
      }"
      @click="emit('toggleButton', player, index)"
    >
      {{ player.socketId ? 'Освободить' : 'Занять' }}
    </UButton>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UCheckbox from '@nuxt/ui/components/Checkbox.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import type { Player } from '@server/modules/types'
import { playerBorderColorClass, playerTextColorClass } from '@/utils/colors'
import { canToggleSlot } from './helpers'

const props = defineProps<{
  player: Player
  index: number
  deviceId: string
}>()

const emit = defineEmits<{
  toggleCheckbox: [player: Player, index: number]
  nameInput: [value: string]
  toggleButton: [player: Player, index: number]
}>()

const checkboxDisabled = computed(() =>
  Boolean(props.player.socketId && props.player.deviceId !== props.deviceId)
)

const canToggle = computed(() => canToggleSlot(props.player, props.deviceId))
</script>
