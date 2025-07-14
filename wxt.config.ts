import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'wxt'

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-vue'],
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  imports: {
    presets: ['@vueuse/core'],
  },
  manifest: {
    name: 'Insight',
    permissions: ['storage', 'tabs'],
    commands: {
      'search:open': {
        suggested_key: {
          mac: 'Alt+Shift+F',
          windows: 'Alt+Shift+F',
          default: 'Alt+Shift+F',
        },
        description: 'Open search in current tab',
      },
    },
  },
})
