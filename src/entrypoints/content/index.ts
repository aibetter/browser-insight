import { MODULES } from '#imports'
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

    browser.runtime.onMessage.addListener((message, _, sendResponse) => {
      switch (message.type) {
        case MODULES.SEARCH: {
          const event = new CustomEvent(CUSTOM_EVENT_KEYS.SEARCH_OPEN, {
            detail: { action: message.action },
          })
          window.dispatchEvent(event)

          sendResponse({ success: true })
          break
        }
      }
    })
  },
})
