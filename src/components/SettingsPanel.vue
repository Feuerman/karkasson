<template>
  <UModal
    :title="t('ui_settings')"
    :open="open"
    size="sm"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <div class="space-y-6">
        <section class="space-y-3">
          <h3 class="text-sm font-semibold text-text">
            {{ t('ui_settings_sound') }}
          </h3>
          <UCheckbox
            v-model="settings.soundEnabled"
            :label="soundLabel"
            class="text-text"
          />
        </section>

        <section class="space-y-3">
          <h3 class="text-sm font-semibold text-text">
            {{ t('ui_settings_animations') }}
          </h3>
          <UCheckbox
            v-model="settings.animationsEnabled"
            :label="t('ui_settings_animations')"
            class="text-text"
          />
          <p class="text-xs text-text-muted">
            Сохраняется в браузере и применяется при следующей загрузке.
          </p>
        </section>

        <section class="space-y-3">
          <h3 class="text-sm font-semibold text-text">
            {{ t('ui_settings_notifications') }}
          </h3>
          <UCheckbox
            v-model="settings.notificationsEnabled"
            :label="t('ui_settings_notifications')"
            class="text-text"
          />
        </section>

        <div class="border-t border-secondary-dark/30" />
      </div>
    </template>

    <template #footer>
      <div class="flex w-full justify-end">
        <UButton
          color="neutral"
          variant="outline"
          class="cursor-pointer"
          @click="close"
        >
          {{ t('ui_settings_close') }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useSettings } from '@/composables/useSettings'
import { t } from '@/utils/i18n'
import UButton from '@nuxt/ui/components/Button.vue'
import UCheckbox from '@nuxt/ui/components/Checkbox.vue'
import UModal from '@nuxt/ui/components/Modal.vue'

withDefaults(
  defineProps<{
    open: boolean
  }>(),
  { open: false }
)

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const settings = useSettings()

const soundLabel = computed(() =>
  settings.soundEnabled.value ? t('ui_sound_on') : t('ui_sound_off')
)

const close = () => emit('update:open', false)
</script>
