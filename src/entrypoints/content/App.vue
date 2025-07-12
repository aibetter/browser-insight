<script setup lang="ts">
import Search from './components/Search.vue'

defineOptions({
  name: 'InsightContentApp',
})

const searchVisible = ref(false)

useEventListener('keydown', (e) => {
  if (e.key === 'f' && e.metaKey) {
    e.preventDefault()
    searchVisible.value = true
  }
  else if (e.key === 'Escape') {
    searchVisible.value = false
  }
})
</script>

<template>
  <div>
    <Transition v-if="searchVisible">
      <Search />
    </Transition>
  </div>
</template>
