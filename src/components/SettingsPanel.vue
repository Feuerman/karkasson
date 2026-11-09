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

        <section class="space-y-3">
          <h3
            class="text-sm font-semibold uppercase tracking-wide text-text-muted"
          >
            {{ t('ui_settings_account') }}
          </h3>

          <div v-if="linkedUserId" class="flex items-center gap-3">
            <span class="text-text-muted text-sm">{{
              t('ui_account_signed_in')
            }}</span>
            <span
              class="text-text text-sm truncate max-w-xs"
              :title="linkedUserId"
            >
              {{ linkedUserId }}
            </span>
          </div>
          <div v-else class="text-sm text-text-muted">
            {{ t('ui_account_not_linked') }}
          </div>

          <UButton
            v-if="!linkedUserId"
            color="primary"
            :loading="linking"
            class="cursor-pointer w-full"
            @click="linkAccount"
          >
            {{ t('ui_account_link_google') }}
          </UButton>

          <div v-if="!linkedUserId" class="space-y-2">
            <label class="flex flex-col gap-1 text-sm text-text-muted">
              {{ t('ui_account_user_id') }}
              <UInput
                v-model="restoreUserId"
                :placeholder="t('ui_account_user_id')"
                class="min-h-10"
                @keydown.enter.prevent="restoreAccount"
              />
            </label>
            <UButton
              color="secondary"
              :loading="restoring"
              class="cursor-pointer w-full"
              @click="restoreAccount"
            >
              {{ t('ui_account_restore_button') }}
            </UButton>
            <p v-if="restoreError" class="text-sm text-negative">
              {{ restoreError }}
            </p>
          </div>
        </section>
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
import { computed, ref } from 'vue'
import { useSettings } from '@/composables/useSettings'
import GameService from '@/modules/GameService'
import { t } from '@/utils/i18n'
import { errorMessage, notifyError } from '@/utils/common'
import notificationService from '@/plugins/notification'
import UButton from '@nuxt/ui/components/Button.vue'
import UCheckbox from '@nuxt/ui/components/Checkbox.vue'
import UInput from '@nuxt/ui/components/Input.vue'
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
const linkedUserId = GameService.userId

const soundLabel = computed(() =>
  settings.soundEnabled.value ? t('ui_sound_on') : t('ui_sound_off')
)

const linking = ref(false)
const restoring = ref(false)
const restoreUserId = ref('')
const restoreError = ref<string | null>(null)

const close = () => emit('update:open', false)

const linkAccount = async () => {
  if (linking.value) return
  restoreError.value = null
  linking.value = true
  try {
    await GameService.linkAccount()
    notificationService.success(t('ui_account_linked'))
  } catch (error) {
    notifyError(error)
  } finally {
    linking.value = false
  }
}

const restoreAccount = async () => {
  if (restoring.value) return
  const userId = restoreUserId.value.trim()
  if (!userId) return
  restoreError.value = null
  restoring.value = true
  try {
    const games = await GameService.restoreAccount(userId)
    notificationService.success(
      t('ui_account_restored', { count: games.length })
    )
    restoreUserId.value = ''
  } catch (error) {
    restoreError.value = errorMessage(
      error,
      t('ui_error_account_restore_failed')
    )
    notifyError(error)
  } finally {
    restoring.value = false
  }
}
</script>
