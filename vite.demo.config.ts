import { fileURLToPath, URL } from 'node:url'
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

const rewriteDemoEntry = (server) => {
  server.middlewares.use((request, response, next) => {
    const requestPath = (request.url ?? '').split('?')[0]
    if (requestPath === '/' || requestPath === '/login' || requestPath === '/login/') {
      request.url = '/demo.html' + (request.url?.slice(requestPath.length) ?? '')
    } else if (requestPath === '/index.html') {
      response.statusCode = 404
      response.end()
      return
    }
    next()
  })
}

const demoOnlyDevEntry = {
  name: 'portfolio-demo-root',
  configureServer: rewriteDemoEntry,
  configurePreviewServer: rewriteDemoEntry,
}

export default defineConfig({
  // Desliga a leitura de .env* apenas nesta configuração de demonstração.
  envDir: false,
  publicDir: false,
  plugins: [vue(), tailwindcss(), demoOnlyDevEntry, {
    name: 'demo-font-license',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'assets/albert-sans-OFL.txt',
        source: readFileSync(new URL('./src/demo/assets/albert-sans-OFL.txt', import.meta.url), 'utf8'),
      })
    },
  }],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  build: {
    modulePreload: { polyfill: false },
    outDir: 'dist-demo',
    emptyOutDir: true,
    rollupOptions: { input: fileURLToPath(new URL('./demo.html', import.meta.url)) },
  },
})
