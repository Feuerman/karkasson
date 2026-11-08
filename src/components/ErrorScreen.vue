<template>
  <div
    class="fixed inset-0 z-[5000] flex items-center justify-center bg-background p-6 text-text"
  >
    <div class="panel-parchment max-w-md w-full p-8 sm:p-12 text-center">
      <UIcon
        name="i-lucide-alert-circle"
        class="h-12 w-12 mx-auto mb-4 text-negative"
      />
      <h1 class="mb-2 text-2xl font-semibold">
        {{ title }}
      </h1>
      <p class="mb-8 text-text-muted break-words">{{ message }}</p>
      <UButton color="primary" class="w-full" @click="emit('reload')">
        {{ reloadLabel }}
      </UButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { t } from '@/utils/i18n'
import UButton from '@nuxt/ui/components/Button.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'

const emit = defineEmits<{
  reload: []
}>()

withDefaults(
  defineProps<{
    /** Показываемое пользователю сообщение об ошибке. */
    message: string
    /** Заголовок экрана. По умолчанию — общая фраза про ошибку. */
    title?: string
    /** Подпись кнопки перезагрузки. */
    reloadLabel?: string
  }>(),
  {
    title: t('ui_error_critical'),
    reloadLabel: t('ui_error_reload'),
  }
)
</script>
