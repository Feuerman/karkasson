import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import { resolve } from 'path'
import fs from 'fs-extra'

// https://vitejs.dev/config/
export default defineConfig({
  base: '/karkasson/', // Имя вашего репозитория
  plugins: [
    vue({
      script: {
        defineModel: true,
        propsDestructure: true,
      },
    }),
    vueDevTools(),
    {
      name: 'copy-tiles',
      closeBundle: async () => {
        const sourceDir = resolve(__dirname, 'src/assets/tiles')
        const targetDir = resolve(__dirname, 'dist/src/assets/tiles')
        
        // Ensure target directory exists
        await fs.ensureDir(targetDir)
        
        // Copy all PNG files
        const files = await fs.readdir(sourceDir)
        for (const file of files) {
          if (file.endsWith('.png')) {
            await fs.copy(
              resolve(sourceDir, file),
              resolve(targetDir, file)
            )
          }
        }
      }
    }
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
    },
    copyPublicDir: true,
    assetsDir: './src/assets/tiles',
    outDir: './dist',
  },
})
