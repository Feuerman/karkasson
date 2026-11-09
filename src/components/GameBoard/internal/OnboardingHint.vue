<template>
  <transition name="fade">
    <div
      v-if="step"
      class="fixed bottom-[16rem] left-1/2 -translate-x-1/2 z-[4000] flex flex-col items-center gap-2"
      :data-testid="TEST_IDS.onboardingHint"
    >
      <div
        class="max-w-[28rem] rounded-xl border border-amber-500/50 bg-amber-50/90 px-4 py-3 text-sm leading-relaxed text-amber-900 shadow-card backdrop-blur-sm"
      >
        <div class="flex items-baseline gap-1.5 mb-2">
          <UIcon name="i-lucide-bulb" class="h-5 w-5 shrink-0 text-amber-600" />
          <span class="font-semibold">{{ step.title }}</span>
        </div>
        <p class="last:mb-0">{{ step.hint }}</p>
        <p class="mt-2 text-xs text-text-muted">
          Шаг {{ stepIndex + 1 }} из {{ totalSteps }}
        </p>
      </div>

      <div class="flex gap-2">
        <UButton color="primary" @click="emit('done', step.id)">
          {{ t('ui_onboarding_done') }}
        </UButton>
        <UButton
          color="neutral"
          variant="outline"
          @click="emit('skip', step.id)"
        >
          {{ t('ui_onboarding_skip') }}
        </UButton>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { t } from '@/utils/i18n'
import { TEST_IDS } from '@/data/testIds'
import type { OnboardingStep } from '@/composables/useOnboarding'
import UButton from '@nuxt/ui/components/Button.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'

defineProps<{
  step: OnboardingStep | null
  stepIndex: number
  totalSteps: number
}>()

const emit = defineEmits<{
  done: [id: string]
  skip: [id: string]
}>()
</script>
