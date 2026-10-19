<template>
  <GamePanel
    v-if="showRecall"
    draggable-id="abbot-recall"
    :initial-x="initialX"
    :initial-y="16"
    :drag-enabled="dragEnabled"
    :collapsed="collapsed"
    icon="i-lucide-church"
    title="Отзыв аббата"
    surface-class="min-w-[220px] max-w-[300px] p-3"
    @toggle="toggle"
  >
    <p class="mb-2 text-[.9rem] leading-relaxed text-text-muted">
      Снять аббата с {{ abbotLocation }} и получить {{ potentialPoints }} очк{{
        pluralSuffix
      }}.
    </p>
    <UButton
      block
      color="primary"
      variant="soft"
      class="btn-primary-action min-h-10 w-full cursor-pointer rounded-lg px-4 font-semibold"
      @click="recallAbbot"
    >
      Забрать аббата
    </UButton>
  </GamePanel>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { OBJECT_TYPE_GENITIVES } from '@/utils/labels'
import type { IGameBoard } from '@/types/game'
import GamePanel from '@/components/GamePanel.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import GameService from '@/modules/GameService'
import { notifyError, pluralForm } from '@/utils/common'
import { usePanelCollapse } from '@/composables/usePanelCollapse'

const props = defineProps({
  gameBoard: {
    type: Object as () => IGameBoard,
    required: true,
  },
  dragEnabled: {
    type: Boolean,
    default: false,
  },
})

const ABBOT_RECALL_PANEL_WIDTH = 260

/** Окно можно свернуть, чтобы не закрывать доску. */
const { collapsed, toggle } = usePanelCollapse('abbot-recall')

// Ширина окна известна только после монтирования, поэтому панель центрируется
// в `onMounted`, а не в момент создания компонента.
const initialX = ref(0)

onMounted(() => {
  initialX.value = Math.max(
    0,
    (window.innerWidth - ABBOT_RECALL_PANEL_WIDTH) / 2
  )
})

const recall = computed(() => props.gameBoard.abbotRecall ?? null)

/**
 * Возможность отзыва и выигрыш считает сервер: клиент только показывает их.
 * Сервер считает их для текущего игрока, поэтому окно видно только в его ход.
 */
const showRecall = computed(
  () => props.gameBoard.isMyTurn && recall.value !== null
)

const abbotLocation = computed(() => {
  const objectType = recall.value?.objectType
  return objectType ? OBJECT_TYPE_GENITIVES[objectType] : ''
})

const potentialPoints = computed(() => recall.value?.points ?? 0)

const pluralSuffix = computed(() =>
  pluralForm(potentialPoints.value, 'о', 'а', 'ов')
)

const recallAbbot = () => {
  void GameService.recallAbbot().catch((error: unknown) => {
    notifyError(error, 'Не удалось отозвать аббата')
  })
}
</script>
