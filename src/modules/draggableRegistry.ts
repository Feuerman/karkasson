// draggableRegistry.ts
type DraggableElement = {
  x: number
  y: number
  width: number
  height: number
}

const registry = new Map<string, DraggableElement>()

export const DraggableRegistry = {
  register(id: string, element: DraggableElement) {
    registry.set(id, element)
  },

  unregister(id: string) {
    registry.delete(id)
  },

  checkCollisions(currentId: string, element: DraggableElement) {
    for (const [id, registered] of registry.entries()) {
      if (
        id !== currentId &&
        element.x < registered.x + registered.width &&
        element.x + element.width > registered.x &&
        element.y < registered.y + registered.height &&
        element.y + element.height > registered.y
      ) {
        return true
      }
    }
    return false
  },

  findFreePosition(
    currentId: string,
    originalX: number,
    originalY: number,
    width: number,
    height: number
  ) {
    let newX = originalX
    let newY = originalY
    let attempts = 0
    const maxAttempts = 100
    const step = 10

    while (attempts < maxAttempts) {
      if (
        !this.checkCollisions(currentId, { x: newX, y: newY, width, height })
      ) {
        return { x: newX, y: newY }
      }

      attempts++
      newX += step

      if (newX > window.innerWidth - width) {
        newX = 0
        newY += step
      }

      if (newY > window.innerHeight - height) {
        newY = 0
      }
    }

    return { x: originalX, y: originalY }
  },
}
