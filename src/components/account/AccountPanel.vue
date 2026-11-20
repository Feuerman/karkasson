<template>
  <UModal
    :title="t('ui_account_title')"
    :open="open"
    size="lg"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <div class="space-y-6">
        <AccountHeader
          :linking="linking"
          :display-name="displayName"
          :photo-url="photoUrl"
          @link="linkAccount"
          @logout="handleLogout"
        />

        <AccountRestore
          :restoring="restoring"
          :error="restoreError"
          @restore="restoreAccount"
        />

        <div class="border-t border-secondary-dark/30" />

        <div class="flex justify-center gap-1">
          <UButton
            :class="[
              'flex-1 max-w-md text-center',
              activeTab === 'my'
                ? 'bg-primary text-white'
                : 'bg-surface-50 text-text-muted hover:bg-surface-100',
            ]"
            variant="outline"
            size="sm"
            @click="switchTab('my')"
          >
            {{ t('ui_stats_my_stats') }}
          </UButton>
          <UButton
            :class="[
              'flex-1 max-w-md text-center',
              activeTab === 'leaderboard'
                ? 'bg-primary text-white'
                : 'bg-surface-50 text-text-muted hover:bg-surface-100',
            ]"
            variant="outline"
            size="sm"
            @click="switchTab('leaderboard')"
          >
            {{ t('ui_stats_leaderboard') }}
          </UButton>
        </div>

        <AccountStats
          v-if="activeTab === 'my'"
          :user-stats="userStats"
          :stats-loading="statsLoading"
          :stats-error="statsError"
        />

        <AccountLeaderboard
          v-else
          :leaderboard="leaderboard"
          :leaderboard-loading="leaderboardLoading"
          :leaderboard-error="leaderboardError"
          :profile-names="profileNames"
        />
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
import { ref, watch } from 'vue'
import GameService from '@/modules/GameService'
import { t } from '@/utils/i18n'
import { notifyError } from '@/utils/common'
import { getCurrentUser } from '@/modules/firebaseAuth'
import type { LeaderboardEntry, UserStatsRecord } from '@/types/socket'
import UButton from '@nuxt/ui/components/Button.vue'
import UModal from '@nuxt/ui/components/Modal.vue'
import AccountHeader from './AccountHeader.vue'
import AccountRestore from './AccountRestore.vue'
import AccountStats from './AccountStats.vue'
import AccountLeaderboard from './AccountLeaderboard.vue'

withDefaults(
  defineProps<{
    open: boolean
  }>(),
  { open: false }
)

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const linkedUserId = GameService.userId

const activeTab = ref<'my' | 'leaderboard'>('my')

const userStats = ref<UserStatsRecord | null>(null)
const statsLoading = ref(false)
const statsError = ref<string | null>(null)

const leaderboard = ref<LeaderboardEntry[]>([])
const leaderboardLoading = ref(false)
const leaderboardError = ref<string | null>(null)
const profileNames = ref<Record<string, string>>({})

const displayName = ref<string | null>(null)
const photoUrl = ref<string | null>(null)

const linking = ref(false)
const restoring = ref(false)
const restoreError = ref<string | null>(null)

const close = () => emit('update:open', false)

const linkAccount = async () => {
  if (linking.value) return
  restoreError.value = null
  linking.value = true
  try {
    await GameService.linkAccount()
  } catch (error) {
    notifyError(error)
  } finally {
    linking.value = false
  }
}

const restoreAccount = async (userId: string) => {
  if (restoring.value) return
  restoreError.value = null
  restoring.value = true
  try {
    await GameService.restoreAccount(userId)
  } catch (error) {
    restoreError.value = t('ui_error_account_restore_failed')
    notifyError(error)
  } finally {
    restoring.value = false
  }
}

const handleLogout = async () => {
  try {
    await GameService.logout()
  } catch {
    // Игнорируем ошибки — сессия всё равно сбрасывается локально.
  }
  close()
}

const loadProfile = async () => {
  if (!linkedUserId.value) return
  try {
    const response = await GameService.getUserProfile(linkedUserId.value)
    const currentUser = getCurrentUser()
    const name =
      response.profile?.displayName ??
      response.profile?.photoURL ??
      currentUser?.displayName ??
      linkedUserId.value
    displayName.value = name
    photoUrl.value = response.profile?.photoURL ?? currentUser?.photoURL ?? null
  } catch {
    const currentUser = getCurrentUser()
    displayName.value = currentUser?.displayName ?? linkedUserId.value
    photoUrl.value = currentUser?.photoURL ?? null
  }
}

const loadStats = async () => {
  if (!linkedUserId.value) return
  statsLoading.value = true
  statsError.value = null
  try {
    const response = await GameService.getUserStats(linkedUserId.value)
    userStats.value = response.stats ?? null
  } catch (error) {
    statsError.value = t('ui_error_stats_fetch_failed')
    notifyError(error)
  } finally {
    statsLoading.value = false
  }
}

const loadLeaderboard = async () => {
  leaderboardLoading.value = true
  leaderboardError.value = null
  try {
    const response = await GameService.getLeaderboard(10)
    leaderboard.value = response.leaderboard ?? []

    for (const entry of leaderboard.value) {
      try {
        const profileResp = await GameService.getUserProfile(entry.userId)
        const name =
          profileResp.profile?.displayName ??
          profileResp.profile?.photoURL ??
          entry.userId
        profileNames.value[entry.userId] = name
      } catch {
        profileNames.value[entry.userId] = entry.userId
      }
    }
  } catch (error) {
    leaderboardError.value = t('ui_error_leaderboard_fetch_failed')
    notifyError(error)
  } finally {
    leaderboardLoading.value = false
  }
}

const switchTab = (value: 'my' | 'leaderboard') => {
  activeTab.value = value
  if (value === 'my' && !userStats.value) {
    loadStats()
  }
  if (value === 'leaderboard' && leaderboard.value.length === 0) {
    loadLeaderboard()
  }
}

// Загружаем профиль и статистику при изменении привязанного аккаунта.
watch(
  linkedUserId,
  () => {
    if (linkedUserId.value) {
      loadProfile()
      displayName.value = linkedUserId.value
      loadStats()
    } else {
      displayName.value = null
      photoUrl.value = null
      userStats.value = null
      leaderboard.value = []
      profileNames.value = {}
    }
  },
  { immediate: true }
)
</script>
