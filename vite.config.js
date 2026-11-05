import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import ui from '@nuxt/ui/vite'

const DEFAULT_SERVER_URL = 'https://karkasson.onrender.com'

function contentSecurityPolicy(serverUrl) {
  const websocketUrl = serverUrl.replace(/^http/, 'ws')
  const connectSources = [...new Set(["'self'", serverUrl, websocketUrl])].join(
    ' '
  )
  const directives = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob:",
    `connect-src ${connectSources}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ]

  // Смешанный контент недопустим на HTTPS-странице: поднимаем случайные
  // http-запросы до https, если клиент собирается для защищённого сервера.
  if (serverUrl.startsWith('https://')) {
    directives.push('upgrade-insecure-requests')
  }

  const policy = directives.join('; ')

  return {
    name: 'karkasson-csp',
    apply: 'build',
    transformIndexHtml() {
      return [
        {
          tag: 'meta',
          attrs: {
            'http-equiv': 'Content-Security-Policy',
            content: policy,
          },
          injectTo: 'head-prepend',
        },
      ]
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const serverUrl = env.VITE_SERVER_URL || DEFAULT_SERVER_URL

  return {
    base: '/karkasson/',
    plugins: [
      vue({
        script: {
          defineModel: true,
          propsDestructure: true,
        },
      }),
      ui({
        router: false,
        dts: false,
        colorMode: false,
        icon: {
          clientBundle: {
            // Иконки собираются в бандл: CSP запрещает запросы к API
            // Iconify, а внешняя загрузка ещё и зависит от стороннего CDN.
            scan: {
              globInclude: ['**/*.{vue,js,ts,jsx,tsx}'],
              globExclude: [
                '**/node_modules/**',
                '**/dist/**',
                '**/build/**',
                '**/coverage/**',
                '**/tests/**',
                '**/test-results/**',
                '**/playwright-report/**',
                '**/.*/**',
              ],
            },
          },
        },
      }),
      vueDevTools(),
      contentSecurityPolicy(serverUrl),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
        '@server': fileURLToPath(new URL('./server/src', import.meta.url)),
      },
    },
    build: {
      copyPublicDir: true,
      publicDir: 'public',
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              {
                name: 'vendor',
                test: /node_modules/,
                minSize: 20_000,
                maxSize: 350_000,
              },
            ],
          },
        },
      },
    },
  }
})
