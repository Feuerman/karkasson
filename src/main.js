import './assets/main.css'

import { createApp } from 'vue'
import ui from '@nuxt/ui/vue-plugin'
import App from './App.vue'
import { createLogger } from './utils/logger'
import { initLocale } from './utils/i18n'
import { setCriticalError } from './modules/criticalError'

// Язык определяется до монтирования приложения, чтобы первые рендеры
// компонентов уже использовали выбранную локаль.
initLocale()

const logger = createLogger('client')

/**
 * Глобальный обработчик ошибок приложения.
 *
 * Любая необработанная ошибка компонента или промиса переводит приложение
 * на экран «что-то пошло не так» с кнопкой перезагрузки, вместо того чтобы
 * оставить пустой или частично сломанный UI. Стек и сообщение пишутся в
 * серверный/клиентский журнал; в errorHandler входит только нетехнический
 * отчёт, без персональных данных.
 */
function handleCriticalError(error, source) {
  logger.error(
    `Необработанная ошибка приложения${source ? `: ${source}` : ''}`,
    {
      error,
    }
  )
  setCriticalError(error)
}

const app = createApp(App)

app.config.errorHandler = (error, instance, info) => {
  handleCriticalError(error, `Vue ${info}`)
}

window.addEventListener('unhandledrejection', (event) => {
  handleCriticalError(event.reason, 'unhandled promise rejection')
})

app.use(ui)

app.mount('#app')
