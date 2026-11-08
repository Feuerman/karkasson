<template>
  <UModal
    :description="t('lobby_create_description')"
    :open="open"
    @update:open="emit('update:open', $event)"
  >
    <template #title>
      <span :data-testid="TEST_IDS.createGameModalTitle">
        {{ t('lobby_create_title') }}
      </span>
    </template>
    <template #body>
      <div class="space-y-5">
        <OptionToggle
          v-model="finalScoringEnabled"
          :label="t('lobby_final_scoring')"
          :description="t('lobby_final_scoring_description')"
          :test-id="TEST_IDS.createGameFinalScoring"
        />

        <div class="border-t border-secondary-dark/30" />

        <section class="space-y-3">
          <h3
            class="text-sm font-semibold uppercase tracking-wide text-text-muted"
          >
            {{ t('lobby_expansions') }}
          </h3>
          <OptionToggle
            v-model="innsAndCathedralsEnabled"
            :label="t('expansion_inns')"
            :description="t('expansion_inns_description')"
          />
          <OptionToggle
            v-model="riverEnabled"
            :label="t('expansion_river')"
            :description="t('expansion_river_description')"
          />
          <OptionToggle
            v-model="princessAndDragonEnabled"
            :label="t('expansion_princess')"
            :description="t('expansion_princess_description')"
            :test-id="TEST_IDS.createGamePrincessDragon"
          />
        </section>
      </div>
    </template>

    <p v-if="error" class="mb-3 text-sm text-negative text-center">
      {{ error }}
    </p>

    <template #footer>
      <div class="flex w-full justify-end gap-3">
        <UButton
          color="neutral"
          variant="outline"
          class="cursor-pointer"
          :disabled="pending"
          @click="close"
        >
          {{ t('lobby_cancel') }}
        </UButton>
        <UButton
          color="primary"
          :data-testid="TEST_IDS.createGameSubmit"
          :loading="pending"
          class="btn-primary-action cursor-pointer"
          @click="create"
        >
          {{ t('lobby_create_submit') }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import type { CreateGameOptions } from '@/modules/GameService'
import UButton from '@nuxt/ui/components/Button.vue'
import UModal from '@nuxt/ui/components/Modal.vue'
import { TEST_IDS } from '@/data/testIds'
import { t } from '@/utils/i18n'
import OptionToggle from './OptionToggle.vue'

const props = withDefaults(
  defineProps<{
    open: boolean
    /** Команда создания игры выполняется: кнопка в состоянии ожидания. */
    pending: boolean
    /** Ошибка создания сервера: показываем внутри модалки. */
    error: string | null
  }>(),
  { pending: false, error: null }
)

const emit = defineEmits<{
  'update:open': [value: boolean]
  create: [options: CreateGameOptions]
}>()

const finalScoringEnabled = ref(false)
const innsAndCathedralsEnabled = ref(false)
const riverEnabled = ref(false)
const princessAndDragonEnabled = ref(false)

const close = () => emit('update:open', false)

const create = () => {
  emit('create', {
    finalScoringEnabled: finalScoringEnabled.value,
    innsAndCathedralsEnabled: innsAndCathedralsEnabled.value,
    riverEnabled: riverEnabled.value,
    princessAndDragonEnabled: princessAndDragonEnabled.value,
  })
}

// Модалка закрывается по ответу сервера, а не сразу: пока команда выполняется,
// окно остаётся открытым с индикатором на кнопке.
watch(
  () => props.pending,
  (pending) => {
    if (!pending) emit('update:open', false)
  }
)
</script>
