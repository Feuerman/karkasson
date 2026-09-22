<template>
  <Draggable draggable-id="saved-games">
    <UCard
      class="w-72"
      :ui="{ root: 'rounded-lg', body: 'flex flex-col gap-2 p-4' }"
    >
      <div
        v-for="savedGame in savedGames"
        :key="savedGame.id"
        class="flex items-center justify-between gap-2"
      >
        <UButton variant="outline" color="neutral" class="flex-1">
          {{ savedGame.name }}
        </UButton>
        <UButton
          variant="ghost"
          color="error"
          icon="i-lucide-x"
          square
          class="justify-center"
        />
      </div>
      <UInput v-model="savedGameName" type="text" placeholder="Название" />
      <UButton color="primary" icon="i-lucide-save" label="Save Game" />
    </UCard>
  </Draggable>
</template>
<script setup lang="ts">
import { ref } from 'vue'
import type { IGameBoard } from '@/types/game'
import Draggable from '@/components/Draggable.vue'
import UCard from '@nuxt/ui/components/Card.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UInput from '@nuxt/ui/components/Input.vue'

defineProps({
  gameBoard: {
    type: Object as () => IGameBoard,
    required: true,
  },
})

const savedGameName = ref('')

const savedGames = ref<{ id: string; name: string }[]>([])
</script>
