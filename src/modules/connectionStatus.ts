/** Фаза соединения с сервером, которую показывает интерфейс. */
import { t } from '@/utils/i18n'

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
  return attempt > 0 ? ` ${t('connection_attempt', { attempt })}` : ''
}

/** Описание состояния соединения для индикатора и экрана восстановления. */
export function describeConnectionStatus(
  snapshot: ConnectionSnapshot
): ConnectionStatusView {
  if (snapshot.phase === 'connected') {
    return {
      label: t('connection_connected'),
      details: '',
      tone: 'success',
      overlay: false,
      canRetry: false,
    }
  }

  if (snapshot.phase === 'replaced') {
    return {
      label: t('connection_replaced_label'),
      details: t('connection_replaced_details'),
      tone: 'warning',
      overlay: true,
      canRetry: true,
    }
  }

  if (!snapshot.isOnline) {
    return {
      label: t('connection_offline_label'),
      details: t('connection_offline_details'),
      tone: 'error',
      overlay: true,
      canRetry: true,
    }
  }

  if (snapshot.phase === 'connecting') {
    return {
      label: t('connection_connecting_label'),
      details: t('connection_connecting_details'),
      tone: 'warning',
      overlay: false,
      canRetry: false,
    }
  }

  const attempt = attemptSuffix(snapshot.reconnectAttempt)

  if (snapshot.lastDisconnectReason === 'io server disconnect') {
    return {
      label: t('connection_server_closed_label'),
      details: `${t('connection_server_closed_details')}${attempt}`,
      tone: 'error',
      overlay: true,
      canRetry: true,
    }
  }

  switch (snapshot.errorCode) {
    case 'timeout':
      return {
        label: t('connection_timeout_label'),
        details: `${t('connection_timeout_details')}${attempt}`,
        tone: 'warning',
        overlay: true,
        canRetry: true,
      }
    case 'transport':
      return {
        label: t('connection_transport_label'),
        details: `${t('connection_transport_details')}${attempt}`,
        tone: 'warning',
        overlay: true,
        canRetry: true,
      }
    case 'server':
      return {
        label: t('connection_server_down_label'),
        details: `${t('connection_server_down_details')}${attempt}`,
        tone: 'warning',
        overlay: true,
        canRetry: true,
      }
    default:
      return {
        label: t('connection_lost_label'),
        details: `${t('connection_lost_details')}${attempt}`,
        tone: 'warning',
        overlay: true,
        canRetry: true,
      }
  }
}
