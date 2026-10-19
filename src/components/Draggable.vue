<template>
  <div
    ref="draggableElement"
    class="absolute z-[2000] max-h-[90vh] touch-manipulation will-change-transform"
    :data-draggable-id="draggableId"
    :class="
      isDragging
        ? 'pointer-events-none cursor-grabbing select-none transition-none'
        : [
            'pointer-events-auto transition-transform duration-200 ease',
            dragEnabled && !disabled ? 'cursor-grab' : '',
          ]
    "
    :style="dragStyle"
    @pointerdown="startDrag"
  >
    <slot />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { DraggableRegistry } from '@/modules/draggableRegistry'
import {
  panelLayoutVersion,
  readSavedPanelLayout,
  savePanelPosition,
} from '@/modules/panelLayout'

const props = withDefaults(
  defineProps<{
    initialX?: number
    initialY?: number
    draggableId?: string
    isNoneStyle?: boolean
    disabled?: boolean
    dragEnabled?: boolean
    rightOffset?: number
  }>(),
  {
    initialX: 0,
    initialY: 0,
    draggableId: '',
    isNoneStyle: false,
    disabled: false,
    dragEnabled: true,
  }
)

const emit = defineEmits(['drag', 'drag-start', 'drag-end'])

const dragPosition = ref({ x: props.initialX, y: props.initialY })
const isDragging = ref(false)
/** Панель с `rightOffset` прижата к правому краю, пока её не перетащили. */
const isDetachedFromEdge = ref(false)
const startPos = ref({ x: 0, y: 0 })
const elementOffset = ref({ x: 0, y: 0 })
const draggableElement = ref<HTMLElement | null>(null)
const elementSize = ref({ width: 0, height: 0 })

let resizeObserver: ResizeObserver | null = null

/**
 * Место окна, к которому возвращается панель.
 *
 * Для панели у правого края это отступ от края окна, для остальных — исходные
 * координаты, заданные компонентом.
 */
const initialPosition = (width: number): { x: number; y: number } => {
  if (props.rightOffset === undefined) {
    return { x: props.initialX, y: props.initialY }
  }
  return {
    x: Math.max(16, window.innerWidth - width - props.rightOffset),
    y: props.initialY,
  }
}

/** Пересчитывает размер окна и обновляет его в реестре наложений. */
const updateElementSize = () => {
  const element = draggableElement.value
  if (!element) return

  const rect = element.getBoundingClientRect()
  if (
    rect.width === elementSize.value.width &&
    rect.height === elementSize.value.height
  ) {
    return
  }

  elementSize.value = { width: rect.width, height: rect.height }
  DraggableRegistry.register(props.draggableId, {
    x: dragPosition.value.x,
    y: dragPosition.value.y,
    width: rect.width,
    height: rect.height,
  })
}

onMounted(async () => {
  await nextTick()

  const element = draggableElement.value
  if (!element) return

  const rect = element.getBoundingClientRect()
  elementSize.value = {
    width: rect.width,
    height: rect.height,
  }

  // Сохранённое место применяется до расчёта наложений, иначе окна
  // «прыгают» при загрузке страницы.
  const savedPosition = readSavedPanelLayout().positions[props.draggableId]
  if (savedPosition) {
    dragPosition.value = { x: savedPosition.x, y: savedPosition.y }
    isDetachedFromEdge.value = true
  } else {
    dragPosition.value = initialPosition(rect.width)
  }

  dragPosition.value = DraggableRegistry.placeCollisionFree(
    props.draggableId,
    dragPosition.value.x,
    dragPosition.value.y,
    elementSize.value.width,
    elementSize.value.height
  )

  // Окно меняет размер, когда его сворачивают или разворачивают: реестр
  // наложений должен знать актуальные размеры.
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(updateElementSize)
    resizeObserver.observe(element)
  }
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
  document.removeEventListener('pointermove', onDragMove)
  document.removeEventListener('pointerup', stopDrag)
  document.removeEventListener('pointercancel', stopDrag)
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

// Сброс раскладки возвращает окна на исходные места.
watch(panelLayoutVersion, () => {
  const element = draggableElement.value
  if (!element) return

  const rect = element.getBoundingClientRect()
  elementSize.value = { width: rect.width, height: rect.height }
  isDetachedFromEdge.value = false

  const position = initialPosition(rect.width)
  dragPosition.value = DraggableRegistry.placeCollisionFree(
    props.draggableId,
    position.x,
    position.y,
    rect.width,
    rect.height
  )
})

const startDrag = (event: PointerEvent) => {
  if (!draggableElement.value || props.disabled || !props.dragEnabled) return
  if (event.button !== 0) return
  if (event.isPrimary === false) return
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
  document.addEventListener('pointermove', onDragMove)
  document.addEventListener('pointerup', stopDrag)
  document.addEventListener('pointercancel', stopDrag)
}

const onDragMove = (event: PointerEvent) => {
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
  document.removeEventListener('pointermove', onDragMove)
  document.removeEventListener('pointerup', stopDrag)
  document.removeEventListener('pointercancel', stopDrag)

  if (!isDragging.value) return

  isDragging.value = false
  if (props.rightOffset !== undefined) isDetachedFromEdge.value = true

  if (draggableElement.value) {
    dragPosition.value = DraggableRegistry.placeCollisionFree(
      props.draggableId,
      dragPosition.value.x,
      dragPosition.value.y,
      elementSize.value.width,
      elementSize.value.height
    )
  }

  // Место окна запоминается: после перезагрузки окна будут здесь же.
  savePanelPosition(props.draggableId, {
    x: dragPosition.value.x,
    y: dragPosition.value.y,
  })

  emit('drag-end', { x: dragPosition.value.x, y: dragPosition.value.y })
}

/**
 * Привязанная к правому краю панель позиционируется через `right`, поэтому не
 * смещается при изменении ширины окна. После перетаскивания она остаётся там,
 * где её оставили, и дальше считается по `left`.
 */
const dragStyle = computed(() => {
  const top = `${dragPosition.value.y}px`
  if (props.rightOffset !== undefined && !isDetachedFromEdge.value) {
    return { top, right: `${props.rightOffset}px` }
  }
  return { top, left: `${dragPosition.value.x}px` }
})
</script>
