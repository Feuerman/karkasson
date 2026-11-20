<template>
  <section class="space-y-4">
    <div
      v-if="leaderboardError"
      class="p-3 bg-negative/10 border border-negative rounded text-negative text-sm"
    >
      {{ leaderboardError }}
    </div>

    <div
      v-if="leaderboardLoading && !leaderboard?.length"
      class="p-3 text-sm text-text-muted"
    >
      Загрузка таблицы лидеров…
    </div>

    <table v-if="leaderboard?.length" class="w-full text-left border-collapse">
      <thead>
        <tr class="border-b border-secondary-dark/30">
          <th class="py-2 text-xs text-text-muted font-semibold w-12">
            {{ t('ui_stats_place') }}
          </th>
          <th class="py-2 text-xs text-text-muted font-semibold">
            {{ t('ui_stats_player') }}
          </th>
          <th
            class="py-2 text-xs text-text-muted font-semibold text-right w-20"
          >
            {{ t('ui_stats_games_played') }}
          </th>
          <th
            class="py-2 text-xs text-text-muted font-semibold text-right w-20"
          >
            {{ t('ui_stats_wins') }}
          </th>
          <th
            class="py-2 text-xs text-text-muted font-semibold text-right w-20"
          >
            {{ t('ui_stats_total_score') }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(entry, index) in leaderboard"
          :key="entry.userId"
          class="border-b border-secondary-light/50 hover:bg-surface-50/50"
        >
          <td class="py-2 text-sm text-text-muted">{{ index + 1 }}</td>
          <td class="py-2 text-sm text-text">
            {{ profileNames[entry.userId] || entry.userId }}
          </td>
          <td class="py-2 text-sm text-text text-right">
            {{ entry.gamesPlayed }}
          </td>
          <td class="py-2 text-sm text-text text-right">{{ entry.wins }}</td>
          <td class="py-2 text-sm text-text text-right">
            {{ entry.totalScore }}
          </td>
        </tr>
      </tbody>
    </table>

    <div
      v-if="leaderboard && leaderboard.length === 0"
      class="p-3 text-sm text-text-muted"
    >
      {{ t('ui_stats_leaderboard_empty') }}
    </div>
  </section>
</template>

<script setup lang="ts">
import { t } from '@/utils/i18n'
import type { LeaderboardEntry } from '@/types/socket'

defineProps<{
  leaderboard: LeaderboardEntry[]
  leaderboardLoading: boolean
  leaderboardError: string | null
  profileNames: Record<string, string>
}>()
</script>
