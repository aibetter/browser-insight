<script lang="ts" setup>
import packageInfo from '../../../package.json'

const version = packageInfo.version

const { enable: searchEnabled } = useSearch()

// Toggle search functionality
function toggleSearch() {
  searchEnabled.value = !searchEnabled.value
}
</script>

<template>
  <div class="w-80 bg-white text-gray-900">
    <!-- Header -->
    <div class="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-6">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
          <i class="icon-[material-symbols--search-insights] text-2xl" />
        </div>
        <div>
          <h1 class="text-xl font-bold">
            Browser Insight
          </h1>
          <p class="text-blue-100 text-sm">
            v{{ version }}
          </p>
        </div>
      </div>
    </div>

    <!-- Main content -->
    <div class="p-6">
      <!-- Search functionality card -->
      <div
        class="relative p-4 rounded-lg border-2 cursor-pointer transition-all duration-300 group"
        :class="[
          searchEnabled
            ? 'bg-blue-50 border-blue-200 hover:border-blue-300 shadow-lg'
            : 'bg-gray-50 border-gray-200 hover:border-gray-300 hover:bg-gray-100',
        ]"
        @click="toggleSearch"
      >
        <!-- Active indicator -->
        <div
          v-if="searchEnabled"
          class="absolute top-2 right-2 w-2 h-2 bg-blue-500 rounded-full animate-pulse"
        />

        <!-- Card content -->
        <div class="flex items-center gap-3">
          <div class="flex-1">
            <div class="flex items-center gap-2 mb-0.5">
              <h3 class="font-medium text-base text-gray-900">
                Search
              </h3>
              <span
                class="px-2 py-0.5 text-xs font-medium rounded-full"
                :class="searchEnabled
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-gray-100 text-gray-600'"
              >
                {{ searchEnabled ? 'ON' : 'OFF' }}
              </span>
            </div>

            <p class="text-xs text-gray-500">
              {{ searchEnabled ? 'Press Cmd/Ctrl + F' : 'Click to enable' }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Custom toggle switch animation */
.toggle-switch {
  transition: all 0.3s ease;
}
</style>
