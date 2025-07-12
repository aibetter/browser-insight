import { createApp } from 'vue'
import App from './App.vue'
import '@/assets/tailwind.css'

export default defineContentScript({
  matches: ['<all_urls>'],
  cssInjectionMode: 'ui',
  async main(ctx) {
    const ui = await createShadowRootUi(ctx, {
      name: 'insight-content',
      position: 'inline',
      anchor: 'body',
      onMount: (container) => {
        const app = createApp(App)
        app.mount(container)
        return app
      },
      onRemove: (app) => {
        app?.unmount()
      },
    })

    ui.mount()
  },
})
