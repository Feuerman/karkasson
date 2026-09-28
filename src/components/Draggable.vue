<template>
  <div
    ref="draggableElement"
    class="absolute z-[2000] max-h-[90vh] touch-none will-change-transform"
    :class="
      isDragging
        ? 'pointer-events-none transition-none'
        : [
            'pointer-events-auto transition-transform duration-200 ease',
            dragEnabled && !disabled ? 'cursor-grab' : '',
          ]
    "
    :style="dragStyle"
    @mousedown="startDrag"
  >
    <slot />
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
  dragEnabled: { type: Boolean, default: true },
  rightOffset: { type: Number, default: null },
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

    if (props.rightOffset !== null) {
      dragPosition.value.x = Math.max(
        16,
        window.innerWidth - rect.width - props.rightOffset
      )
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
  if (!draggableElement.value || props.disabled || !props.dragEnabled) return
  if (
    event.target instanceof Element &&
    event.target.closest('button, a, input, textarea, select, [data-no-drag]')
  ) {
    return
  }
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
