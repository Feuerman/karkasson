// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp } from 'vue'

vi.mock('@nuxt/ui/components/Button.vue', () => ({
  default: {
    name: 'UButton',
    props: ['color', 'onClick'],
    template: '<button :class="color" @click="onClick"><slot /></button>',
  },
}))
vi.mock('@nuxt/ui/components/Icon.vue', () => ({
  default: {
    name: 'UIcon',
    props: ['name', 'class'],
    template: '<i :class="name"></i>',
  },
}))

import ErrorScreen from '@/components/ErrorScreen.vue'

function renderErrorScreen(props: {
  message?: string
  title?: string
  reloadLabel?: string
  onReload?: () => void
}) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const app = createApp(ErrorScreen, props)
  app.mount(host)
  return { host }
}

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('ErrorScreen', () => {
  it('показывает сообщение и заголовок по умолчанию', () => {
    const { host } = renderErrorScreen({ message: 'Сервер недоступен' })

    expect(host.textContent).toContain('Что-то пошло не так')
    expect(host.textContent).toContain('Сервер недоступен')
    expect(host.textContent).toContain('Перезагрузить страницу')
  })

  it('показывает кастомизированный заголовок и подпись кнопки', () => {
    const { host } = renderErrorScreen({
      message: 'Что-то пошло не так',
      title: 'Сбой приложения',
      reloadLabel: 'Обновить',
    })

    expect(host.textContent).toContain('Сбой приложения')
    expect(host.textContent).toContain('Обновить')
  })

  it('вызывает reload по нажатию кнопки', () => {
    let reloaded = false
    const { host } = renderErrorScreen({
      message: 'ошибка',
      onReload: () => {
        reloaded = true
      },
    })

    const button = host.querySelector('button')
    expect(button).not.toBeNull()
    button?.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(reloaded).toBe(true)
  })
})
