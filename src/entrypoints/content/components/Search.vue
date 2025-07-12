<script setup lang="ts">
defineOptions({
  name: 'InsightContentSearch',
})

const searchKey = ref('')
</script>

<template>
  <div class="w-64 fixed top-2 right-2 z-[999999] bg-white/75 backdrop-blur-lg p-4 rounded-xl shadow-2xl  hover:shadow-3xl transition-all">
    <div class="flex items-center gap-2">
      <input
        v-model="searchKey"
        placeholder="Search everything in page"
        class="flex-1 focus:outline-none"
      >
    </div>
  </div>
</template>
