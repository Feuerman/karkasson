<template>
  <div v-if="!linkedUserId" class="space-y-2">
    <label class="flex flex-col gap-1 text-sm text-text-muted">
      {{ t('ui_account_user_id') }}
      <UInput
        v-model="restoreUserId"
        :placeholder="t('ui_account_user_id')"
        class="min-h-10"
        @keydown.enter.prevent="onRestore"
      />
    </label>
    <UButton
      color="secondary"
      :loading="restoring"
      class="cursor-pointer w-full"
      @click="onRestore"
    >
      {{ t('ui_account_restore_button') }}
    </UButton>
    <p v-if="error" class="text-sm text-negative">
      {{ error }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import GameService from '@/modules/GameService'
import { t } from '@/utils/i18n'
import UButton from '@nuxt/ui/components/Button.vue'
import UInput from '@nuxt/ui/components/Input.vue'

defineProps<{
  restoring: boolean
  error: string | null
}>()

const emit = defineEmits<{
  restore: [userId: string]
}>()

const linkedUserId = GameService.userId

const restoreUserId = ref('')

const onRestore = () => {
  const userId = restoreUserId.value.trim()
  if (!userId) return
  emit('restore', userId)
}
</script>
