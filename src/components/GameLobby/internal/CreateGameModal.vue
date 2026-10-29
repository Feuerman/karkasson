<template>
  <UModal
    description="Настройте правила новой партии"
    :open="open"
    @update:open="emit('update:open', $event)"
  >
    <template #title>
      <span :data-testid="TEST_IDS.createGameModalTitle"> Создание игры </span>
    </template>
    <template #body>
      <div class="space-y-5">
        <OptionToggle
          v-model="finalScoringEnabled"
          label="Финальный подсчёт очков"
          description="Если включить опцию, в конце партии очки начислятся за незавершённые дороги, города, монастыри и сады."
          :test-id="TEST_IDS.createGameFinalScoring"
        />

        <div class="border-t border-secondary-dark/30" />

        <section class="space-y-3">
          <h3
            class="text-sm font-semibold uppercase tracking-wide text-text-muted"
          >
            Дополнения
          </h3>
          <OptionToggle
            v-model="innsAndCathedralsEnabled"
            label="Таверны и соборы"
            description="Добавляет 18 тайлов дополнения и большого подданного."
          />
          <OptionToggle
            v-model="riverEnabled"
            label="Река"
            description="В начале партии выкладывается река от истока до озера, затем идёт обычная колода."
          />
          <OptionToggle
            v-model="princessAndDragonEnabled"
            label="Принцесса и дракон"
            description="Добавляет тайлы с принцессой, драконом и вулканом."
            :test-id="TEST_IDS.createGamePrincessDragon"
          />
        </section>
      </div>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-3">
        <UButton
          color="neutral"
          variant="outline"
          class="cursor-pointer"
          :disabled="pending"
          @click="close"
        >
          Отмена
        </UButton>
        <UButton
          color="primary"
          :data-testid="TEST_IDS.createGameSubmit"
          :loading="pending"
          class="btn-primary-action cursor-pointer"
          @click="create"
        >
          Создать игру
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
import OptionToggle from './OptionToggle.vue'

const props = withDefaults(
  defineProps<{
    open: boolean
    /** Команда создания игры выполняется: кнопка в состоянии ожидания. */
    pending: boolean
  }>(),
  { pending: false }
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
