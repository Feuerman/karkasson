<template>
  <section class="space-y-3">
    <h3 class="text-sm font-semibold uppercase tracking-wide text-text-muted">
      {{ t('ui_settings_account') }}
    </h3>

    <div
      v-if="linkedUserId"
      class="flex items-center gap-4 p-4 bg-surface-50 border border-secondary-light rounded-lg"
    >
      <span class="text-sm text-text-muted">{{
        t('ui_account_signed_in')
      }}</span>
      <div class="flex items-center gap-2">
        <img
          v-if="photoUrl"
          :src="photoUrl"
          :alt="displayName ?? ''"
          class="w-8 h-8 rounded-full object-cover"
        />
        <span
          v-else
          class="w-8 h-8 rounded-full bg-secondary-dark/20 flex items-center justify-center shrink-0"
        >
          <UIcon name="i-lucide-user" class="h-4 w-4" />
        </span>
        <span
          class="text-text text-sm truncate max-w-xs"
          :title="displayName ?? ''"
        >
          {{ displayName }}
        </span>
      </div>
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

    <UButton
      v-if="linkedUserId"
      color="negative"
      variant="outline"
      class="cursor-pointer w-full mt-2"
      @click="logout"
    >
      {{ t('ui_account_logout') }}
    </UButton>
  </section>
</template>

<script setup lang="ts">
import GameService from '@/modules/GameService'
import { t } from '@/utils/i18n'
import UIcon from '@nuxt/ui/components/Icon.vue'

defineProps<{
  linking: boolean
  displayName: string | null
  photoUrl: string | null
}>()

const emit = defineEmits<{
  link: []
  logout: []
}>()

const linkedUserId = GameService.userId

const linkAccount = () => {
  emit('link')
}

const logout = async () => {
  try {
    await GameService.logout()
  } catch {
    // Игнорируем ошибки — сессия всё равно сбрасывается локально.
  }
  emit('logout')
}
</script>
