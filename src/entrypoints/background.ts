import { MODULES } from '#imports'

export default defineBackground(() => {
  // Listen for command events
  browser.commands.onCommand.addListener(async (command) => {
    if (command === 'search:open') {
      try {
        const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true })

        if (activeTab?.id) {
          await browser.tabs.sendMessage(activeTab.id, {
            type: MODULES.SEARCH,
            action: 'open',
          })
        }
      }
      catch (error) {
        console.error('Error handling search command:', error)
      }
    }
  })
})
