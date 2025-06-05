import './assets/main.css'

import { createApp } from 'vue'
import App from './App.vue'
import VueDnDKitPlugin from '@vue-dnd-kit/core'

const app = createApp(App)

// Register plugins
app.use(VueDnDKitPlugin)

app.mount('#app')
