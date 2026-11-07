/** Фаза соединения с сервером, которую показывает интерфейс. */
export type ConnectionPhase =
  'connecting' | 'connected' | 'reconnecting' | 'offline' | 'replaced'

/** Причина ошибки рукопожатия, сведённая к понятной категории. */
export type ConnectionErrorCode = 'timeout' | 'transport' | 'server' | 'unknown'

export interface ConnectionSnapshot {
  phase: ConnectionPhase
  isOnline: boolean
  reconnectAttempt: number
  lastDisconnectReason: string | null
  errorCode: ConnectionErrorCode | null
}

export type ConnectionTone = 'success' | 'warning' | 'error'

export interface ConnectionStatusView {
  label: string
  details: string
  tone: ConnectionTone
  /** Полноэкранное состояние вместо компактного индикатора. */
  overlay: boolean
  canRetry: boolean
}

/**
 * Сводит текст ошибки socket.io-client к категории для интерфейса.
 * Технические подробности остаются в журнале, игроку показывается
 * понятная причина.
 */
export function classifyConnectError(message: string): ConnectionErrorCode {
  const value = message.toLowerCase()
  if (value.includes('timeout')) return 'timeout'
  if (
    value.includes('websocket') ||
    value.includes('xhr') ||
    value.includes('poll') ||
    value.includes('transport')
  ) {
    return 'transport'
  }
  if (value.includes('server')) return 'server'
  return 'unknown'
}

function attemptSuffix(attempt: number): string {
  return attempt > 0 ? ` Попытка ${attempt}.` : ''
}

/** Описание состояния соединения для индикатора и экрана восстановления. */
export function describeConnectionStatus(
  snapshot: ConnectionSnapshot
): ConnectionStatusView {
  if (snapshot.phase === 'connected') {
    return {
      label: 'Подключено',
      details: '',
      tone: 'success',
      overlay: false,
      canRetry: false,
    }
  }

  if (snapshot.phase === 'replaced') {
    return {
      label: 'Партия открыта в другой вкладке',
      details:
        'Управление передано другой вкладке. Здесь можно вернуть его себе.',
      tone: 'warning',
      overlay: true,
      canRetry: true,
    }
  }

  if (!snapshot.isOnline) {
    return {
      label: 'Нет подключения',
      details: 'Проверьте подключение к интернету, затем попробуйте снова.',
      tone: 'error',
      overlay: true,
      canRetry: true,
    }
  }

  if (snapshot.phase === 'connecting') {
    return {
      label: 'Подключение…',
      details: 'Устанавливаем соединение с сервером.',
      tone: 'warning',
      overlay: false,
      canRetry: false,
    }
  }

  const attempt = attemptSuffix(snapshot.reconnectAttempt)

  if (snapshot.lastDisconnectReason === 'io server disconnect') {
    return {
      label: 'Сервер закрыл соединение',
      details: `Переподключаемся к серверу.${attempt}`,
      tone: 'error',
      overlay: true,
      canRetry: true,
    }
  }

  switch (snapshot.errorCode) {
    case 'timeout':
      return {
        label: 'Сервер не отвечает',
        details: `Ждём ответа сервера.${attempt}`,
        tone: 'warning',
        overlay: true,
        canRetry: true,
      }
    case 'transport':
      return {
        label: 'Сервер недоступен',
        details: `Не удалось установить соединение.${attempt}`,
        tone: 'warning',
        overlay: true,
        canRetry: true,
      }
    case 'server':
      return {
        label: 'Сервер недоступен',
        details: `Сервер временно недоступен.${attempt}`,
        tone: 'warning',
        overlay: true,
        canRetry: true,
      }
    default:
      return {
        label: 'Нет связи с сервером',
        details: `Пытаемся восстановить соединение.${attempt}`,
        tone: 'warning',
        overlay: true,
        canRetry: true,
      }
  }
}
