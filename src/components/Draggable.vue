<template>
  <div
    ref="draggableElement"
    class="absolute z-[2000] max-h-[90vh] touch-none will-change-transform"
    :class="
      isDragging
        ? 'pointer-events-none transition-none'
        : 'pointer-events-auto transition-transform duration-200 ease'
    "
    :style="dragStyle"
  >
    <template v-if="isNoneStyle">
      <div @mousedown="startDrag">
        <slot />
      </div>
    </template>
    <template v-else>
      <div
        v-if="!disabled"
        :class="
          isDragging
            ? 'cursor-grabbing bg-[#45a049]'
            : 'cursor-move bg-success/70'
        "
        class="absolute left-1/2 top-[calc(100%_-_2px)] flex h-3 w-[30px] -translate-x-1/2 items-center justify-center overflow-hidden rounded-lg text-xs font-bold text-white shadow-soft transition-colors duration-300 after:absolute after:-left-1 after:-top-1 after:h-[calc(100%_+_8px)] after:w-[calc(100%_+_8px)] after:bg-black/10 after:content-['']"
        @mousedown="startDrag"
      />
      <slot />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { DraggableRegistry } from '@/modules/draggableRegistry'

const props = defineProps({
  initialX: { type: Number, default: 0 },
  initialY: { type: Number, default: 0 },
  draggableId: { type: String, default: '' },
  isNoneStyle: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
})

const emit = defineEmits(['drag', 'drag-start', 'drag-end'])

const dragPosition = ref({ x: props.initialX, y: props.initialY })
const isDragging = ref(false)
const startPos = ref({ x: 0, y: 0 })
const elementOffset = ref({ x: 0, y: 0 })
const draggableElement = ref<HTMLElement | null>(null)
const elementSize = ref({ width: 0, height: 0 })

onMounted(async () => {
  await nextTick()

  if (draggableElement.value) {
    const rect = draggableElement.value.getBoundingClientRect()
    elementSize.value = {
      width: rect.width,
      height: rect.height,
    }

    dragPosition.value = DraggableRegistry.placeCollisionFree(
      props.draggableId,
      dragPosition.value.x,
      dragPosition.value.y,
      elementSize.value.width,
      elementSize.value.height
    )
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('mousemove', onDragMove)
  document.removeEventListener('mouseup', stopDrag)
  DraggableRegistry.unregister(props.draggableId)
})

watch(
  () => props.initialX,
  (newX) => {
    if (!isDragging.value && draggableElement.value) {
      dragPosition.value.x = Math.min(
        Math.max(newX, 0),
        window.innerWidth - elementSize.value.width
      )
    }
  }
)

watch(
  () => props.initialY,
  (newY) => {
    if (!isDragging.value && draggableElement.value) {
      dragPosition.value.y = Math.min(
        Math.max(newY, 0),
        window.innerHeight - elementSize.value.height
      )
    }
  }
)

const startDrag = (event: MouseEvent) => {
  if (!draggableElement.value || props.disabled) return
  isDragging.value = true
  startPos.value = {
    x: event.clientX,
    y: event.clientY,
  }
  elementOffset.value = {
    x: dragPosition.value.x,
    y: dragPosition.value.y,
  }
  emit('drag-start', { x: dragPosition.value.x, y: dragPosition.value.y })
  event.preventDefault()
  document.addEventListener('mousemove', onDragMove)
  document.addEventListener('mouseup', stopDrag)
}

const onDragMove = (event: MouseEvent) => {
  if (!isDragging.value || !draggableElement.value) return

  let newX = elementOffset.value.x + (event.clientX - startPos.value.x)
  let newY = elementOffset.value.y + (event.clientY - startPos.value.y)

  // Ограничиваем перемещение в пределах экрана
  newX = Math.max(
    0,
    Math.min(newX, window.innerWidth - elementSize.value.width)
  )
  newY = Math.max(
    0,
    Math.min(newY, window.innerHeight - elementSize.value.height)
  )

  dragPosition.value = { x: newX, y: newY }

  emit('drag', {
    x: dragPosition.value.x,
    y: dragPosition.value.y,
    clientX: dragPosition.value.x,
    clientY: dragPosition.value.y,
  })
}

const stopDrag = () => {
  if (isDragging.value) {
    isDragging.value = false
    emit('drag-end', { x: dragPosition.value.x, y: dragPosition.value.y })

    if (draggableElement.value) {
      dragPosition.value = DraggableRegistry.placeCollisionFree(
        props.draggableId,
        dragPosition.value.x,
        dragPosition.value.y,
        elementSize.value.width,
        elementSize.value.height
      )
    }
  }

  document.removeEventListener('mousemove', onDragMove)
  document.removeEventListener('mouseup', stopDrag)
}

const dragStyle = computed(() => ({
  top: `${dragPosition.value.y}px`,
  left: `${dragPosition.value.x}px`,
}))
</script>
