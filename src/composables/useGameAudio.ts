import { onBeforeUnmount, onMounted } from 'vue'

type SoundName = 'turn' | 'score' | 'end'

interface UseGameAudioOptions {
  soundEnabled: boolean
}

const SOUND_INTERVAL_MS = 250

/**
 * Звуковые эффекты игры через Web Audio API.
 *
 * Управляет аудиоконтекстом, разблокировкой аудио при первом взаимодействии
 * пользователя и дросселированием повторяющихся звуков. Жизненный цикл
 * контекста привязан к компоненту: поднимается при монтировании, закрывается
 * при размонтировании.
 */
export function useGameAudio({ soundEnabled }: UseGameAudioOptions) {
  let audioContext: AudioContext | null = null
  let audioUnlocked = false
  const lastSoundAt: Record<SoundName, number> = {
    turn: 0,
    score: 0,
    end: 0,
  }

  const audioContextClass = (): typeof AudioContext | undefined => {
    if (typeof window === 'undefined') return undefined
    return window.AudioContext
  }

  const getAudioContext = (): AudioContext | null => {
    const AudioContextClass = audioContextClass()
    if (!AudioContextClass) return null

    if (!audioContext) {
      try {
        audioContext = new AudioContextClass()
      } catch {
        return null
      }
    }

    if (audioContext.state === 'suspended') {
      void audioContext.resume().catch(() => undefined)
    }
    return audioContext
  }

  const unlockAudio = () => {
    audioUnlocked = true
    void getAudioContext()
      ?.resume()
      .catch(() => undefined)
  }

  const closeAudioContext = () => {
    if (!audioContext) return
    void audioContext.close().catch(() => undefined)
    audioContext = null
  }

  type Waveform = 'sine' | 'square' | 'sawtooth' | 'triangle'

  const playTone = (
    context: AudioContext,
    frequency: number,
    delay: number,
    duration: number,
    volume: number,
    type: Waveform
  ) => {
    const startAt = context.currentTime + delay
    const oscillator = context.createOscillator()
    const gain = context.createGain()

    oscillator.type = type
    oscillator.frequency.setValueAtTime(frequency, startAt)
    gain.gain.setValueAtTime(0, startAt)
    gain.gain.linearRampToValueAtTime(volume, startAt + 0.012)
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration)

    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.start(startAt)
    oscillator.stop(startAt + duration + 0.03)
  }

  const playSound = (name: SoundName) => {
    if (!soundEnabled || !audioUnlocked) return

    const now = Date.now()
    if (now - lastSoundAt[name] < SOUND_INTERVAL_MS) return
    lastSoundAt[name] = now

    const context = getAudioContext()
    if (!context) return

    if (name === 'turn') {
      playTone(context, 660, 0, 0.12, 0.05, 'sine')
      playTone(context, 880, 0.09, 0.16, 0.045, 'sine')
      return
    }

    if (name === 'score') {
      playTone(context, 523.25, 0, 0.1, 0.045, 'triangle')
      playTone(context, 659.25, 0.08, 0.12, 0.045, 'triangle')
      playTone(context, 783.99, 0.17, 0.18, 0.04, 'triangle')
      return
    }

    playTone(context, 523.25, 0, 0.14, 0.05, 'triangle')
    playTone(context, 659.25, 0.12, 0.14, 0.05, 'triangle')
    playTone(context, 783.99, 0.24, 0.16, 0.05, 'triangle')
    playTone(context, 1046.5, 0.38, 0.3, 0.045, 'triangle')
  }

  onMounted(() => {
    document.addEventListener('pointerdown', unlockAudio, { once: true })
    document.addEventListener('keydown', unlockAudio, { once: true })
  })

  onBeforeUnmount(() => {
    document.removeEventListener('pointerdown', unlockAudio)
    document.removeEventListener('keydown', unlockAudio)
    closeAudioContext()
  })

  return { playSound, closeAudioContext }
}
