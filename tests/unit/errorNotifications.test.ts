import { afterEach, describe, expect, it, vi } from 'vitest'
import { describePlacementFailure } from '@server/socket/handlers/placementErrors'
import notificationService, {
  NotificationType,
  registerNotificationBridge,
  unregisterNotificationBridge,
  type NotificationOptions,
} from '@/plugins/notification'
import { notifyError } from '@/utils/common'

type Shown = {
  type: NotificationType
  message: string
  options?: NotificationOptions
}

function captureNotifications(): Shown[] {
  const shown: Shown[] = []
  registerNotificationBridge({
    show(type, message, options) {
      shown.push({ type, message, options })
    },
  })
  return shown
}

afterEach(() => {
  unregisterNotificationBridge()
})

describe('Уведомления об ошибках', () => {
  it('показывает ошибку с заголовком и долгим временем показа', () => {
    const shown = captureNotifications()

    notificationService.error(describePlacementFailure([]))

    expect(shown).toEqual([
      {
        type: NotificationType.Error,
        message: describePlacementFailure([]),
        options: { title: 'Ошибка', duration: 10000 },
      },
    ])
  })

  it('оставляет обычные уведомления без заголовка и с автоскрытием', () => {
    const shown = captureNotifications()

    notificationService.success('Ход сделан')
    notificationService.info('Партия найдена')

    expect(shown).toEqual([
      {
        type: NotificationType.Success,
        message: 'Ход сделан',
        options: undefined,
      },
      {
        type: NotificationType.Info,
        message: 'Партия найдена',
        options: undefined,
      },
    ])
  })

  it('позволяет переопределить заголовок и время показа', () => {
    const shown = captureNotifications()

    notificationService.warning('Подтвердите действие', {
      title: 'Внимание',
      sticky: true,
      duration: 5000,
    })

    expect(shown[0]?.options).toEqual({
      title: 'Внимание',
      sticky: true,
      duration: 5000,
    })
  })

  it('не показывает ничего без подключённого адаптера', () => {
    unregisterNotificationBridge()

    expect(() => notificationService.error('Ошибка')).not.toThrow()
  })
})

describe('notifyError', () => {
  it('показывает текст серверного отказа', () => {
    const shown = captureNotifications()

    notifyError(new Error('Сейчас ход другого игрока'))

    expect(shown[0]?.message).toBe('Сейчас ход другого игрока')
    expect(shown[0]?.type).toBe(NotificationType.Error)
  })

  it('показывает строковый отказ как есть', () => {
    const shown = captureNotifications()

    notifyError('Нет соединения с сервером')

    expect(shown[0]?.message).toBe('Нет соединения с сервером')
  })

  it('подставляет запасной текст для неизвестного отказа', () => {
    const shown = captureNotifications()

    notifyError({ code: 500 }, 'Не удалось выбрать клетку')
    notifyError(new Error(), 'Не удалось выбрать клетку')

    expect(shown.map(({ message }) => message)).toEqual([
      'Не удалось выбрать клетку',
      'Не удалось выбрать клетку',
    ])
  })

  it('не падает, если уведомления ещё не подключены', () => {
    unregisterNotificationBridge()

    expect(() => notifyError(new Error('Ошибка'))).not.toThrow()
  })
})

describe('Мост уведомлений', () => {
  it('снимает мост при размонтировании', () => {
    const show = vi.fn()
    const unregister = registerNotificationBridge({ show })

    unregister()
    notificationService.error('Ошибка')

    expect(show).not.toHaveBeenCalled()
  })

  it('не снимает мост, если его заменили другим', () => {
    const first = vi.fn()
    const second = vi.fn()
    const unregisterFirst = registerNotificationBridge({ show: first })
    registerNotificationBridge({ show: second })

    unregisterFirst()
    notificationService.error('Ошибка')

    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
  })
})
