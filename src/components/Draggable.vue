<template>
  <div
    class="draggable"
    :style="dragStyle"
    ref="draggableElement"
    :class="{ 'draggable--dragging': isDragging }"
  >
    <template v-if="isNoneStyle">
      <div @mousedown="startDrag">
        <slot />
      </div>
    </template>
    <template v-else>
      <div v-if="!disabled" class="draggable__icon" @mousedown="startDrag" />
      <slot />
    </template>
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  ref,
  onMounted,
  onUnmounted,
  watch,
  defineProps,
  defineEmits,
  nextTick,
} from 'vue'
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

    // Проверяем, чтобы начальная позиция была в пределах экрана
    dragPosition.value.x = Math.min(
      Math.max(dragPosition.value.x, 0),
      window.innerWidth - elementSize.value.width
    )
    dragPosition.value.y = Math.min(
      Math.max(dragPosition.value.y, 0),
      window.innerHeight - elementSize.value.height
    )

    DraggableRegistry.register(props.draggableId, {
      x: dragPosition.value.x,
      y: dragPosition.value.y,
      width: elementSize.value.width,
      height: elementSize.value.height,
    })

    if (
      DraggableRegistry.checkCollisions(props.draggableId, {
        x: dragPosition.value.x,
        y: dragPosition.value.y,
        width: elementSize.value.width,
        height: elementSize.value.height,
      })
    ) {
      const freePosition = DraggableRegistry.findFreePosition(
        props.draggableId,
        dragPosition.value.x,
        dragPosition.value.y,
        elementSize.value.width,
        elementSize.value.height
      )
      dragPosition.value = freePosition
      DraggableRegistry.register(props.draggableId, {
        x: freePosition.x,
        y: freePosition.y,
        width: elementSize.value.width,
        height: elementSize.value.height,
      })
    }
  }
})

onUnmounted(() => {
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
      DraggableRegistry.register(props.draggableId, {
        x: dragPosition.value.x,
        y: dragPosition.value.y,
        width: elementSize.value.width,
        height: elementSize.value.height,
      })

      if (
        DraggableRegistry.checkCollisions(props.draggableId, {
          x: dragPosition.value.x,
          y: dragPosition.value.y,
          width: elementSize.value.width,
          height: elementSize.value.height,
        })
      ) {
        const freePosition = DraggableRegistry.findFreePosition(
          props.draggableId,
          dragPosition.value.x,
          dragPosition.value.y,
          elementSize.value.width,
          elementSize.value.height
        )
        dragPosition.value = freePosition
        DraggableRegistry.register(props.draggableId, {
          x: freePosition.x,
          y: freePosition.y,
          width: elementSize.value.width,
          height: elementSize.value.height,
        })
      }
    }
  }

  document.removeEventListener('mousemove', onDragMove)
  document.removeEventListener('mouseup', stopDrag)
}

const dragStyle = computed(() => ({
  transition: isDragging.value ? 'none' : 'transform 0.2s ease',
  pointerEvents: isDragging.value ? 'none' : 'auto',
  position: 'absolute',
  top: `${dragPosition.value.y}px`,
  left: `${dragPosition.value.x}px`,
}))
</script>

<style scoped lang="scss">
.draggable {
  position: absolute;
  z-index: 2000;
  touch-action: none;
  will-change: transform;
  max-height: 90vh;
  &__icon {
    cursor: move;
    position: absolute;
    top: calc(100% - 2px);
    left: 50%;
    transform: translateX(-50%);
    width: 30px;
    height: 12px;
    background-color: rgba(76, 175, 80, 0.7);
    color: #fff;
    display: flex;
    justify-content: center;
    align-items: center;
    font-size: 12px;
    font-weight: bold;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    overflow: hidden;
    transition: width 0.3s ease;
    &::after {
      content: '';
      position: absolute;
      top: -4px;
      left: -4px;
      width: calc(100% + 8px);
      height: calc(100% + 8px);
      background-color: rgba(0, 0, 0, 0.1);
    }
  }
  &--dragging {
    //box-shadow: 0 2px 10px rgba(255, 255, 255, 1);
    .draggable__icon {
      cursor: grabbing;
      background-color: #45a049;
    }
  }
}
</style>
