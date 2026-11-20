<template>
  <section v-if="linkedUserId" class="space-y-4">
    <div
      v-if="statsError"
      class="p-3 bg-negative/10 border border-negative rounded text-negative text-sm"
    >
      {{ statsError }}
    </div>

    <div
      v-if="userStats && !statsLoading"
      class="grid grid-cols-2 md:grid-cols-4 gap-3"
    >
      <div class="p-3 bg-surface-50 border border-secondary-light rounded-lg">
        <div class="text-xs text-text-muted">
          {{ t('ui_stats_games_played') }}
        </div>
        <div class="text-lg font-semibold text-text">
          {{ userStats.gamesPlayed }}
        </div>
      </div>
      <div class="p-3 bg-surface-50 border border-secondary-light rounded-lg">
        <div class="text-xs text-text-muted">{{ t('ui_stats_wins') }}</div>
        <div class="text-lg font-semibold text-positive">
          {{ userStats.wins }}
        </div>
      </div>
      <div class="p-3 bg-surface-50 border border-secondary-light rounded-lg">
        <div class="text-xs text-text-muted">{{ t('ui_stats_losses') }}</div>
        <div class="text-lg font-semibold text-negative">
          {{ userStats.losses }}
        </div>
      </div>
      <div class="p-3 bg-surface-50 border border-secondary-light rounded-lg">
        <div class="text-xs text-text-muted">
          {{ t('ui_stats_total_score') }}
        </div>
        <div class="text-lg font-semibold text-text">
          {{ userStats.totalScore }}
        </div>
      </div>
    </div>

    <div v-if="!linkedUserId" class="p-3 text-sm text-text-muted">
      {{ t('ui_error_account_not_linked') }}
    </div>

    <div v-if="statsLoading && !userStats" class="p-3 text-sm text-text-muted">
      Загрузка статистики…
    </div>

    <div
      v-if="userStats && userStats.gamesPlayed === 0"
      class="p-3 text-sm text-text-muted"
    >
      {{ t('ui_stats_no_stats') }}
    </div>
  </section>
</template>

<script setup lang="ts">
import GameService from '@/modules/GameService'
import { t } from '@/utils/i18n'
import type { UserStatsRecord } from '@/types/socket'

defineProps<{
  userStats: UserStatsRecord | null
  statsLoading: boolean
  statsError: string | null
}>()

const linkedUserId = GameService.userId
</script>
