import { ref, type Ref } from 'vue'

const SOUND_KEY = 'soundEnabled'
const ANIMATIONS_KEY = 'animationsEnabled'
const NOTIFICATIONS_KEY = 'notificationsEnabled'

function readBoolean(key: string, defaultValue: boolean): boolean {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return defaultValue
    return raw !== 'false'
  } catch {
    return defaultValue
  }
}

function writeBoolean(key: string, value: boolean): void {
  try {
    localStorage.setItem(key, String(value))
  } catch {
    // Приватный режим или переполненное хранилище: настройка проживёт до
    // перезагрузки страницы, но приложение не должно падать.
  }
}

export interface SettingsState {
  soundEnabled: boolean
  animationsEnabled: boolean
  notificationsEnabled: boolean
}

export interface Settings {
  soundEnabled: Ref<boolean>
  animationsEnabled: Ref<boolean>
  notificationsEnabled: Ref<boolean>
  toggleSound: () => void
  toggleAnimations: () => void
  toggleNotifications: () => void
}

export function useSettings(): Settings {
  const soundEnabled = ref(readBoolean(SOUND_KEY, true))
  const animationsEnabled = ref(readBoolean(ANIMATIONS_KEY, true))
  const notificationsEnabled = ref(readBoolean(NOTIFICATIONS_KEY, true))

  const toggleSound = (): void => {
    soundEnabled.value = !soundEnabled.value
    writeBoolean(SOUND_KEY, soundEnabled.value)
  }

  const toggleAnimations = (): void => {
    animationsEnabled.value = !animationsEnabled.value
    writeBoolean(ANIMATIONS_KEY, animationsEnabled.value)
  }

  const toggleNotifications = (): void => {
    notificationsEnabled.value = !notificationsEnabled.value
    writeBoolean(NOTIFICATIONS_KEY, notificationsEnabled.value)
  }

  return {
    soundEnabled,
    animationsEnabled,
    notificationsEnabled,
    toggleSound,
    toggleAnimations,
    toggleNotifications,
  }
}
