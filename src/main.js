import './assets/main.css'

import { createApp } from 'vue'
import ui from '@nuxt/ui/vue-plugin'
import App from './App.vue'
import { initLocale } from './utils/i18n'

// Язык определяется до монтирования приложения, чтобы первые рендеры
// компонентов уже использовали выбранную локаль.
initLocale()

const app = createApp(App)

app.use(ui)

app.mount('#app')
