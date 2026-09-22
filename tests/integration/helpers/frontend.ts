import { fileURLToPath, URL } from 'node:url'
import type { AddressInfo } from 'node:net'
import { createServer as createViteServer } from 'vite'
import vue from '@vitejs/plugin-vue'
import ui from '@nuxt/ui/vite'

export interface RunningFrontend {
  viteServer: Awaited<ReturnType<typeof createViteServer>>
  port: number
  url: string
  serverUrl: string
  fetch: (path?: string) => Promise<Response>
  close: () => Promise<void>
}

const PROJECT_ROOT = fileURLToPath(new URL('../../../', import.meta.url))
const SRC_DIR = fileURLToPath(new URL('../../../../src', import.meta.url))
const SERVER_SRC_DIR = fileURLToPath(
  new URL('../../../server/src', import.meta.url)
)

/**
 * Поднимает настоящий Vite dev-сервер фронтенда и направляет
 * клиенткий socket.io на тестовый игровой сервер через VITE_SERVER_URL.
 */
export async function startTestFrontend(
  serverUrl: string
): Promise<RunningFrontend> {
  process.env.VITE_SERVER_URL = serverUrl

  const viteServer = await createViteServer({
    configFile: false,
    root: PROJECT_ROOT,
    logLevel: 'error',
    server: { host: '127.0.0.1', port: 0 },
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
      }),
    ],
    resolve: {
      alias: {
        '@': SRC_DIR,
        '@server': SERVER_SRC_DIR,
      },
    },
  })

  await viteServer.listen()

  const address = viteServer.httpServer?.address() as AddressInfo | null
  const port = address?.port ?? 0
  const url = `http://127.0.0.1:${port}`

  return {
    viteServer,
    port,
    url,
    serverUrl,
    fetch: async (path = '/') => {
      const response = await fetch(`${url}${path}`)
      return response
    },
    close: async () => {
      await viteServer.close()
    },
  }
}
