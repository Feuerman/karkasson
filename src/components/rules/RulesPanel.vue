<template>
  <USlideover
    :open="open"
    side="right"
    :title="doc.title"
    :description="doc.subtitle"
    class="!max-w-[1160px]"
    :ui="{
      body: 'min-h-0 !flex !flex-row !overflow-hidden !p-0',
      overlay: '!bg-black/70',
      footer: 'border-t border-default',
    }"
    @update:open="onUpdateOpen"
  >
    <template #body>
      <!-- Боковая навигация по разделам (desktop) -->
      <aside
        class="hidden w-72 shrink-0 flex-col border-r border-border bg-surface-soft md:flex"
      >
        <nav class="flex-1 overflow-y-auto py-2">
          <UButton
            v-for="section in doc.sections"
            :key="section.id"
            block
            variant="ghost"
            :color="activeSection === section.id ? 'primary' : 'neutral'"
            :class="[
              'justify-start border-l-2 px-5 py-2 text-left text-[14px] leading-snug transition-colors duration-150',
              activeSection === section.id
                ? '!border-primary bg-primary-soft !text-primary'
                : 'border-transparent text-text hover:bg-surface hover:text-primary',
            ]"
            @click="scrollToSection(section.id)"
          >
            {{ section.title }}
          </UButton>
        </nav>
      </aside>

      <!-- Контент -->
      <section class="flex min-w-0 flex-1 flex-col bg-surface">
        <!-- Чипы разделов (mobile) -->
        <nav
          class="flex gap-2 overflow-x-auto border-b border-border bg-surface-soft px-4 py-2 md:hidden"
        >
          <UButton
            v-for="section in doc.sections"
            :key="section.id"
            size="xs"
            :variant="activeSection === section.id ? 'solid' : 'outline'"
            :color="activeSection === section.id ? 'primary' : 'neutral'"
            class="shrink-0 rounded-full px-3 py-1 text-[13px] whitespace-nowrap transition-colors duration-150"
            @click="scrollToSection(section.id)"
          >
            {{ section.title }}
          </UButton>
        </nav>

        <div
          ref="scrollRef"
          class="flex-1 overflow-y-auto px-5 py-5 lg:px-8 lg:py-6"
          @scroll="onScroll"
        >
          <section
            v-for="section in doc.sections"
            :key="section.id"
            :ref="(el) => setSectionRef(section.id, el)"
            class="mb-8 last:mb-4"
          >
            <h2
              class="mb-3 border-b border-border pb-2 text-xl font-semibold text-text"
            >
              {{ section.title }}
            </h2>
            <RulesBlockRenderer
              v-for="(block, blockIndex) in section.blocks"
              :key="blockIndex"
              :block="block"
            />
          </section>
        </div>
      </section>
    </template>

    <template #footer>
      <div class="flex w-full items-center justify-end gap-2">
        <UButton
          variant="soft"
          color="neutral"
          class="px-3 py-2 font-medium"
          @click="onClose"
        >
          Закрыть
        </UButton>
      </div>
    </template>
  </USlideover>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ComponentPublicInstance } from 'vue'
import USlideover from '@nuxt/ui/components/Slideover.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import RulesBlockRenderer from './RulesBlockRenderer.vue'
import type { RulesDocument } from '@/rules/types'

const props = defineProps<{
  doc: RulesDocument
  open: boolean
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
}>()

const open = computed({
  get: () => props.open,
  set: (value: boolean) => emit('update:open', value),
})

const onUpdateOpen = (value: boolean) => {
  emit('update:open', value)
}

const onClose = () => {
  emit('update:open', false)
}

const scrollRef = ref<HTMLElement | null>(null)
const sectionElements: Record<string, HTMLElement> = {}
const activeSection = ref(props.doc.sections[0]?.id ?? '')

const setSectionRef = (
  id: string,
  el: Element | ComponentPublicInstance | null
) => {
  if (el instanceof Element) {
    sectionElements[id] = el as HTMLElement
  }
}

const scrollToSection = (id: string) => {
  const target = sectionElements[id]
  const container = scrollRef.value
  if (!target || !container) return

  const offset =
    target.getBoundingClientRect().top -
    container.getBoundingClientRect().top +
    container.scrollTop -
    12

  container.scrollTo({ top: offset, behavior: 'smooth' })
  activeSection.value = id
}

const onScroll = () => {
  const container = scrollRef.value
  if (!container) return
  const containerTop = container.getBoundingClientRect().top + 16

  let current = props.doc.sections[0]?.id ?? ''
  props.doc.sections.forEach((section) => {
    const el = sectionElements[section.id]
    if (el && el.getBoundingClientRect().top <= containerTop) {
      current = section.id
    }
  })
  activeSection.value = current
}
</script>
