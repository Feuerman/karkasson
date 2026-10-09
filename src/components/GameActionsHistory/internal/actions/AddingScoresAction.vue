<template>
  <ActionRow icon="i-lucide-coins">
    <strong class="mr-[3px] text-text">Завершён объект.</strong>
    <span
      class="cursor-pointer"
      @click="emit('highlightObject', action.actionData.objectData)"
    >
      {{ objectLabel }}
    </span>
    <span class="text-text">Начислено очков:</span>
    <UTooltip
      :content="{ side: 'left', sideOffset: 8 }"
      :disabled="!hasDetails"
      :ui="{ content: TOOLTIP_CONTENT_CLASS }"
    >
      <span
        :class="hasDetails ? 'cursor-help' : undefined"
        :data-testid="hasDetails ? TEST_IDS.historyScoreDetails : undefined"
      >
        <span
          v-for="(score, playerId) in action.actionData.score.players"
          :key="playerId"
        >
          <PlayerName :color="playerColor(playerId)">
            {{ playerName(playerId) }}
          </PlayerName>
          <strong class="text-[.95rem] font-bold text-text">
            — {{ score ?? 0 }}
            {{ pluralForm(score ?? 0, 'очко', 'очка', 'очков') }},
          </strong>
        </span>
        <UIcon
          v-if="hasDetails"
          name="i-lucide-info"
          class="ml-0.5 inline-block h-3 w-3 align-baseline text-gold-dark"
        />
      </span>
      <template v-if="hasDetails" #content>
        <div
          :data-testid="TEST_IDS.historyScoreDetailsTooltip"
          class="flex max-w-56 flex-col gap-1"
        >
          <ul class="flex flex-col gap-0.5">
            <li
              v-for="line in action.actionData.details ?? []"
              :key="line.label"
              class="flex items-baseline justify-between gap-2 text-[.78rem]"
            >
              <span class="min-w-0 flex-1">
                {{ line.label }}
                <span class="opacity-70"
                  >— {{ line.count }} × {{ line.pointsPerUnit }}</span
                >
              </span>
              <strong class="shrink-0 tabular-nums">{{ line.total }}</strong>
            </li>
          </ul>
          <p
            v-for="modifier in action.actionData.modifiers ?? []"
            :key="modifier"
            class="flex items-center gap-1 text-[.72rem] opacity-90"
          >
            <UIcon name="i-lucide-sparkles" class="h-3 w-3 shrink-0" />
            {{ modifier }}
          </p>
        </div>
      </template>
    </UTooltip>
  </ActionRow>
</template>

<script setup lang="ts">
import UIcon from '@nuxt/ui/components/Icon.vue'
import UTooltip from '@nuxt/ui/components/Tooltip.vue'
import { computed } from 'vue'
import { ActionTypes, ObjectTypes } from '@server/modules/types'
import type { BaseObject, Player } from '@server/modules/types'
import type { GameAction } from '@server/modules/GameManager'
import { TEST_IDS } from '@/data/testIds'
import { pluralForm } from '@/utils/common'
import ActionRow from '../ActionRow.vue'
import PlayerName from '../PlayerName.vue'
import { playerById } from '../players'

const { action, players } = defineProps<{
  action: Extract<GameAction, { actionType: ActionTypes.ADDING_SCORES }>
  players: Player[]
}>()

const emit = defineEmits<{
  highlightObject: [objectData: BaseObject]
}>()

/** Тултип поверх пергамента: светлая подложка, рамка и перенос строк. */
const TOOLTIP_CONTENT_CLASS =
  'block h-auto max-w-64 rounded-md border border-gold-dark/40 bg-surface px-2 py-1.5 text-text shadow-card'

const OBJECT_LABELS: Record<ObjectTypes, string> = {
  [ObjectTypes.ROAD]: 'дорога',
  [ObjectTypes.CITY]: 'город',
  [ObjectTypes.MONASTERY]: 'монастырь',
  [ObjectTypes.GARDEN]: 'сад',
}

const objectLabel = computed(
  () => OBJECT_LABELS[action.actionData.objectType] ?? 'объект'
)

const hasDetails = computed(
  () =>
    Boolean(action.actionData.details?.length) ||
    Boolean(action.actionData.modifiers?.length)
)

const playerColor = (playerId: string | number) =>
  playerById(players, playerId)?.color

const playerName = (playerId: string | number) =>
  playerById(players, playerId)?.name
</script>
