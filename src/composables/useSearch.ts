import { ref } from 'vue'
import { isNil } from '@/utils/is'

export function useSearch() {
  const enable = ref(true)

  // init
  storage.getItem<boolean>('local:enable-search').then((value) => {
    if (isNil(value)) {
      enable.value = true
    }
    else {
      enable.value = !!value
    }
  })

  // sync
  watch(enable, (value) => {
    storage.setItem('local:enable-search', value)
  })

  const unwatch = storage.watch<boolean>('local:enable-search', (value) => {
    if (isNil(value)) {
      enable.value = true
    }
    else {
      enable.value = !!value
    }
  })
  onUnmounted(() => {
    unwatch()
  })

  return {
    enable,
  }
}
