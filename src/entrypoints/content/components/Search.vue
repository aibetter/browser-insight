<script setup lang="ts">
defineOptions({
  name: 'InsightContentSearch',
})

const { enable: searchEnabled } = useSearch()

const isVisible = ref(false)
useEventListener(window, CUSTOM_EVENT_KEYS.SEARCH_OPEN, (e: CustomEvent) => {
  isVisible.value = e.detail?.action === 'open'
})

const searchKey = ref('')
const searchConfig = reactive({
  caseSensitive: false,
  wholeWord: false,
  useRegex: false,
})

const inputRef = useTemplateRef('input')
function focusInput() {
  inputRef.value?.focus()
}

// Handle visibility and auto-focus
watch(isVisible, async (visible) => {
  if (visible) {
    await nextTick()
    focusInput()
  }
  else {
    searchKey.value = ''
    clearHighlights()
    // Optional: Reset search config when hiding search
    // resetSearchConfig()
  }
})

// // Global keyboard event listener for search toggle
useEventListener('keydown', (e) => {
  // Only handle keyboard shortcuts if search is enabled
  if (!searchEnabled.value)
    return

  if (e.key === 'Escape') {
    isVisible.value = false
  }
})

let cacheRebuildTimer: NodeJS.Timeout | null = null

onMounted(() => {
  buildTextNodesCache()
})

onUnmounted(() => {
  if (cacheRebuildTimer)
    clearTimeout(cacheRebuildTimer)

  clearHighlights()

  // Remove dynamically added styles
  const styleElement = document.querySelector('#insight-search-styles')
  if (styleElement) {
    styleElement.remove()
  }
})

// Performance optimizations
interface TextNode {
  node: Text
  text: string
  parent: Element
  bounds?: DOMRect
}

interface SearchMatch {
  textNode: TextNode
  startIndex: number
  endIndex: number
  element?: HTMLElement
}

const matches = ref<SearchMatch[]>([])
const currentIndex = ref(0)
const isSearching = ref(false)

// 1. Text content caching - avoid repeated DOM traversal
const textNodesCache = new WeakMap<Text, TextNode>()

function buildTextNodesCache() {
  // WeakMap doesn't have a clear method, but it will automatically
  // garbage collect entries when Text nodes are removed from DOM

  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        const parent = node.parentElement
        if (!parent)
          return NodeFilter.FILTER_REJECT

        // Skip invisible elements for better performance
        const style = window.getComputedStyle(parent)
        if (style.display === 'none' || style.visibility === 'hidden') {
          return NodeFilter.FILTER_REJECT
        }

        // Skip elements with zero width or height
        const rect = parent.getBoundingClientRect()
        if (rect.width === 0 || rect.height === 0) {
          return NodeFilter.FILTER_REJECT
        }

        // Skip elements with zero opacity
        if (style.opacity === '0') {
          return NodeFilter.FILTER_REJECT
        }

        // Skip script, style, and other non-content elements
        if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'META', 'LINK'].includes(parent.tagName)) {
          return NodeFilter.FILTER_REJECT
        }

        // Skip empty text nodes
        if (!node.textContent?.trim()) {
          return NodeFilter.FILTER_REJECT
        }

        return NodeFilter.FILTER_ACCEPT
      },
    },
  )

  while (walker.nextNode()) {
    const node = walker.currentNode as Text
    const text = node.textContent || ''
    if (text.trim()) {
      textNodesCache.set(node, {
        node,
        text: text.toLowerCase(), // Pre-lowercase for case-insensitive search
        parent: node.parentElement!,
      })
    }
  }
}

// 2. Debounced cache rebuilding on DOM changes
useMutationObserver(document.body, () => {
  if (cacheRebuildTimer)
    clearTimeout(cacheRebuildTimer)

  cacheRebuildTimer = setTimeout(() => {
    // WeakMap automatically handles garbage collection of removed nodes
    // We just need to rebuild the cache for new/modified nodes
    buildTextNodesCache()
  }, 1000)
}, {
  childList: true,
  subtree: true,
  characterData: true,
})

// 3. Optimized search with early termination and batching
function searchInTextNodes(searchText: string, maxResults = 100): SearchMatch[] {
  const results: SearchMatch[] = []

  // Early termination if search is too short
  if (searchText.length < 1)
    return results

  // Since WeakMap doesn't support iteration, we need to traverse DOM again
  // but use the cache to get pre-processed data
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        const parent = node.parentElement
        if (!parent)
          return NodeFilter.FILTER_REJECT

        // Skip invisible elements
        const style = window.getComputedStyle(parent)
        if (style.display === 'none' || style.visibility === 'hidden') {
          return NodeFilter.FILTER_REJECT
        }

        // Skip elements with zero width or height
        const rect = parent.getBoundingClientRect()
        if (rect.width === 0 || rect.height === 0) {
          return NodeFilter.FILTER_REJECT
        }

        // Skip elements with zero opacity
        if (style.opacity === '0') {
          return NodeFilter.FILTER_REJECT
        }

        // Skip script, style, and other non-content elements
        if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'META', 'LINK'].includes(parent.tagName)) {
          return NodeFilter.FILTER_REJECT
        }

        // Skip empty text nodes
        if (!node.textContent?.trim()) {
          return NodeFilter.FILTER_REJECT
        }

        return NodeFilter.FILTER_ACCEPT
      },
    },
  )

  while (walker.nextNode()) {
    const node = walker.currentNode as Text

    // Get cached data or create new entry
    let textNodeData = textNodesCache.get(node)
    if (!textNodeData) {
      textNodeData = {
        node,
        text: node.textContent || '',
        parent: node.parentElement!,
      }
      textNodesCache.set(node, textNodeData)
    }

    // Apply search logic based on options
    const searchResults = findMatches(textNodeData.text, searchText)

    for (const match of searchResults) {
      results.push({
        textNode: textNodeData,
        startIndex: match.start,
        endIndex: match.end,
      })

      if (results.length >= maxResults)
        return results
    }
  }

  return results
}

// Helper function to find matches with case sensitivity and whole word options
function findMatches(text: string, searchText: string): Array<{ start: number, end: number }> {
  const matches: Array<{ start: number, end: number }> = []

  // Handle regex search mode
  if (searchConfig.useRegex) {
    try {
      const flags = searchConfig.caseSensitive ? 'g' : 'gi'
      const regex = new RegExp(searchText, flags)
      let match = regex.exec(text)
      while (match !== null) {
        matches.push({
          start: match.index,
          end: match.index + match[0].length,
        })
        match = regex.exec(text)
      }
    }
    catch (error) {
      // Invalid regex, return empty matches
      console.warn('Invalid regex pattern:', searchText, error)
      return []
    }
    return matches
  }

  // Prepare search text and target text based on case sensitivity
  const targetText = searchConfig.caseSensitive ? text : text.toLowerCase()
  const searchPattern = searchConfig.caseSensitive ? searchText : searchText.toLowerCase()

  if (searchConfig.wholeWord) {
    // Use regex for whole word matching
    const flags = searchConfig.caseSensitive ? 'g' : 'gi'
    const regex = new RegExp(`\\b${escapeRegExp(searchPattern)}\\b`, flags)
    // Use a for loop to avoid assignment in while condition
    let match = regex.exec(targetText)
    while (match !== null) {
      matches.push({
        start: match.index,
        end: match.index + match[0].length,
      })
      match = regex.exec(targetText)
    }
  }
  else {
    // Simple substring search
    let startIndex = 0
    let foundIndex = targetText.indexOf(searchPattern, startIndex)

    // Use a while loop to find all occurrences of the search pattern
    while (foundIndex !== -1) {
      matches.push({
        start: foundIndex,
        end: foundIndex + searchPattern.length,
      })

      startIndex = foundIndex + 1
      foundIndex = targetText.indexOf(searchPattern, startIndex)
    }
  }

  return matches
}

// Helper function to escape regex special characters
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// 4. Efficient highlighting with DocumentFragment
const highlightSearchResult = useDebounceFn((text: string) => {
  isSearching.value = true

  try {
    // Clear previous highlights
    clearHighlights()

    // Find matches using optimized search
    const searchResults = searchInTextNodes(text)

    // Batch DOM updates using DocumentFragment
    const processedNodes = new Set<Text>()

    // Group matches by text node for efficient processing
    const matchesByNode = new Map<Text, SearchMatch[]>()
    for (const match of searchResults) {
      const node = match.textNode.node
      if (!matchesByNode.has(node)) {
        matchesByNode.set(node, [])
      }
      matchesByNode.get(node)!.push(match)
    }

    // Process each node's matches in reverse order to maintain indices
    for (const [node, nodeMatches] of matchesByNode) {
      if (processedNodes.has(node))
        continue
      processedNodes.add(node)

      // Sort matches by position (reverse order for correct index handling)
      nodeMatches.sort((a, b) => b.startIndex - a.startIndex)

      for (const match of nodeMatches) {
        try {
          const range = document.createRange()
          range.setStart(node, match.startIndex)
          range.setEnd(node, match.endIndex)

          // Create highlight element
          const highlightSpan = document.createElement('mark')
          highlightSpan.className = 'insight-search-highlight'
          highlightSpan.setAttribute('data-search-match', 'true')

          // Apply enhanced highlighting styles
          Object.assign(highlightSpan.style, {
            backgroundColor: '#ffeb3b',
            color: '#000',
            padding: '2px 4px',
            borderRadius: '3px',
            fontWeight: '600',
            boxShadow: '0 2px 4px rgba(255, 235, 59, 0.3)',
            border: '1px solid #fdd835',
            transition: 'all 0.2s ease-in-out',
            position: 'relative',
            zIndex: '1000',
          })

          // Use more efficient highlighting method
          const content = range.extractContents()
          highlightSpan.appendChild(content)
          range.insertNode(highlightSpan)

          match.element = highlightSpan
        }
        catch (error) {
          console.warn('Failed to highlight match:', error)
        }
      }
    }

    matches.value = searchResults

    if (searchResults.length > 0) {
      currentIndex.value = 1
      scrollToCurrentMatch()
    }
  }
  finally {
    isSearching.value = false
    // Performance logging removed for production
  }
}, 150)

// 5. Efficient highlight clearing
function clearHighlights() {
  const highlights = document.querySelectorAll('[data-search-match="true"]')

  highlights.forEach((highlight) => {
    const parent = highlight.parentNode
    if (parent) {
      // Move text content back to parent
      const textContent = highlight.textContent || ''
      const textNode = document.createTextNode(textContent)
      parent.replaceChild(textNode, highlight)
      parent.normalize() // Merge adjacent text nodes
    }
  })
}

// 6. Optimized navigation with viewport awareness
function scrollToCurrentMatch() {
  if (matches.value.length === 0)
    return

  const currentMatch = matches.value[currentIndex.value - 1]
  if (currentMatch?.element) {
    // Remove previous current highlight
    document.querySelectorAll('.insight-search-current').forEach((el) => {
      el.classList.remove('insight-search-current')
      el.classList.add('insight-search-highlight')
      // Reset to normal highlight style
      Object.assign((el as HTMLElement).style, {
        backgroundColor: '#ffeb3b',
        color: '#000',
        boxShadow: '0 2px 4px rgba(255, 235, 59, 0.3)',
        border: '1px solid #fdd835',
        animation: 'none',
      })
    })

    // Highlight current match with enhanced style
    currentMatch.element.classList.remove('insight-search-highlight')
    currentMatch.element.classList.add('insight-search-current')

    // Apply enhanced current match styles
    Object.assign(currentMatch.element.style, {
      backgroundColor: '#ff5722',
      color: '#fff',
      fontWeight: '700',
      boxShadow: '0 4px 12px rgba(255, 87, 34, 0.4), 0 0 0 2px rgba(255, 87, 34, 0.2)',
      border: '2px solid #d84315',
      transform: 'scale(1.05)',
      animation: 'insight-pulse 1s ease-in-out',
      zIndex: '1001',
    })

    // Add CSS animation for current match
    if (!document.querySelector('#insight-search-styles')) {
      const style = document.createElement('style')
      style.id = 'insight-search-styles'
      style.textContent = `
        @keyframes insight-pulse {
          0% { transform: scale(1.05); box-shadow: 0 4px 12px rgba(255, 87, 34, 0.4), 0 0 0 2px rgba(255, 87, 34, 0.2); }
          50% { transform: scale(1.1); box-shadow: 0 6px 16px rgba(255, 87, 34, 0.6), 0 0 0 4px rgba(255, 87, 34, 0.3); }
          100% { transform: scale(1.05); box-shadow: 0 4px 12px rgba(255, 87, 34, 0.4), 0 0 0 2px rgba(255, 87, 34, 0.2); }
        }
        
        .insight-search-highlight:hover {
          transform: scale(1.02) !important;
          box-shadow: 0 3px 8px rgba(255, 235, 59, 0.5) !important;
        }
        
        .insight-search-current:hover {
          transform: scale(1.08) !important;
          box-shadow: 0 6px 16px rgba(255, 87, 34, 0.6), 0 0 0 4px rgba(255, 87, 34, 0.3) !important;
        }
      `
      document.head.appendChild(style)
    }

    // Smart scrolling - only scroll if element is not in viewport
    const rect = currentMatch.element.getBoundingClientRect()
    const isInViewport = rect.top >= 0 && rect.bottom <= window.innerHeight

    if (!isInViewport) {
      currentMatch.element.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest',
      })
    }
  }
}

function navigateToNext() {
  if (matches.value.length === 0)
    return
  currentIndex.value = currentIndex.value >= matches.value.length ? 1 : currentIndex.value + 1
  scrollToCurrentMatch()
}

function navigateToPrevious() {
  if (matches.value.length === 0)
    return
  currentIndex.value = currentIndex.value <= 1 ? matches.value.length : currentIndex.value - 1
  scrollToCurrentMatch()
}

// 6. Optimized debounced search
watch([searchKey, searchConfig], ([newValue]) => {
  if (!newValue?.trim()) {
    clearHighlights()
    return
  }

  highlightSearchResult(newValue)
})

// 8. Keyboard shortcuts
function handleKeydown(event: KeyboardEvent) {
  event.stopPropagation()

  if (event.key === 'Enter') {
    event.preventDefault()

    if (event.shiftKey) {
      navigateToPrevious()
    }
    else {
      navigateToNext()
    }
  }
  else if (event.key === 'Escape') {
    isVisible.value = false
  }
}
</script>

<template>
  <div
    v-if="isVisible && searchEnabled"
    class="fixed top-4 left-1/2 transform -translate-x-1/2 z-[999999] bg-white/95 backdrop-blur-md text-neutral-950 rounded-xl shadow-2xl border border-gray-200 transition-all duration-300 ease-in-out"
    style="min-width: 400px; max-width: 90vw;"
  >
    <!-- First row: Search input -->
    <div class="flex items-center gap-3 p-4 pb-2">
      <div class="flex-1 relative">
        <i
          class="icon-[material-symbols--search-rounded] absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-lg"
        />
        <input
          ref="input"
          v-model="searchKey"
          placeholder="Search everything in page"
          class="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          @keydown="handleKeydown"
        >
      </div>

      <!-- Close button -->
      <button
        class="size-8 rounded-md flex items-center justify-center hover:bg-red-50 hover:text-red-600 transition-all duration-200 text-gray-500 cursor-pointer"
        title="Close (Escape)"
        @click="isVisible = false"
      >
        <i class="icon-[material-symbols--close-rounded] text-lg" />
      </button>
    </div>

    <!-- Second row: Actions -->
    <div class="flex items-center justify-between gap-3 px-4 pb-4">
      <!-- Search options with icons -->
      <div class="flex items-center gap-1 px-2 py-1 bg-gray-50 rounded-lg border border-gray-200">
        <!-- Case sensitive toggle -->
        <button
          class="size-7 rounded-md flex items-center justify-center transition-all duration-200 relative group cursor-pointer"
          :class="[
            searchConfig.caseSensitive
              ? 'bg-blue-500 text-white shadow-md hover:bg-blue-600 hover:shadow-lg'
              : 'hover:bg-white hover:shadow-sm text-gray-600 hover:text-gray-800',
          ]"
          :title="searchConfig.caseSensitive ? 'Case sensitive (enabled)' : 'Case sensitive (disabled)'"
          @click="searchConfig.caseSensitive = !searchConfig.caseSensitive"
        >
          <i class="icon-[material-symbols--match-case-rounded] text-sm" />
          <div
            v-if="searchConfig.caseSensitive"
            class="absolute -top-1 -right-1 w-2 h-2 bg-green-400 rounded-full border border-white"
          />
        </button>

        <!-- Whole word toggle -->
        <button
          class="size-7 rounded-md flex items-center justify-center transition-all duration-200 relative group"
          :class="[
            searchConfig.wholeWord && !searchConfig.useRegex
              ? 'bg-blue-500 text-white shadow-md hover:bg-blue-600 hover:shadow-lg cursor-pointer'
              : 'hover:bg-white hover:shadow-sm text-gray-600 hover:text-gray-800 cursor-pointer',
            searchConfig.useRegex ? 'opacity-40 cursor-not-allowed' : '',
          ]"
          :title="searchConfig.wholeWord ? 'Whole word (enabled)' : 'Whole word (disabled)'"
          :disabled="searchConfig.useRegex"
          @click="!searchConfig.useRegex && (searchConfig.wholeWord = !searchConfig.wholeWord)"
        >
          <i class="icon-[material-symbols--match-word-rounded] text-sm" />
          <div
            v-if="searchConfig.wholeWord && !searchConfig.useRegex"
            class="absolute -top-1 -right-1 w-2 h-2 bg-green-400 rounded-full border border-white"
          />
        </button>

        <!-- Regex toggle -->
        <button
          class="size-7 rounded-md flex items-center justify-center transition-all duration-200 relative group cursor-pointer"
          :class="[
            searchConfig.useRegex
              ? 'bg-blue-500 text-white shadow-md hover:bg-blue-600 hover:shadow-lg'
              : 'hover:bg-white hover:shadow-sm text-gray-600 hover:text-gray-800',
          ]"
          :title="searchConfig.useRegex ? 'Regex (enabled)' : 'Regex (disabled)'"
          @click="searchConfig.useRegex = !searchConfig.useRegex"
        >
          <i class="icon-[material-symbols--regular-expression-rounded] text-sm" />
          <div
            v-if="searchConfig.useRegex"
            class="absolute -top-1 -right-1 w-2 h-2 bg-green-400 rounded-full border border-white"
          />
        </button>
      </div>

      <!-- Navigation and counter -->
      <div class="flex items-center gap-1 px-2 py-1 bg-gray-50 rounded-lg border border-gray-200">
        <span class="text-sm text-gray-600 font-medium px-2 whitespace-nowrap">
          {{ matches.length > 0 ? `${currentIndex}/${matches.length}` : '0/0' }}
        </span>
        <div class="w-px h-4 bg-gray-300" />
        <button
          class="size-7 rounded-md flex items-center justify-center transition-all duration-200" :class="[
            matches.length === 0
              ? 'opacity-40 cursor-not-allowed text-gray-400'
              : 'hover:bg-white hover:shadow-sm text-gray-600 hover:text-gray-800 cursor-pointer',
          ]"
          :disabled="matches.length === 0"
          title="Previous match (Shift+Enter)"
          @click="navigateToPrevious"
        >
          <i class="icon-[material-symbols--keyboard-arrow-up-rounded] text-lg" />
        </button>
        <button
          class="size-7 rounded-md flex items-center justify-center transition-all duration-200" :class="[
            matches.length === 0
              ? 'opacity-40 cursor-not-allowed text-gray-400'
              : 'hover:bg-white hover:shadow-sm text-gray-600 hover:text-gray-800 cursor-pointer',
          ]"
          :disabled="matches.length === 0"
          title="Next match (Enter)"
          @click="navigateToNext"
        >
          <i class="icon-[material-symbols--keyboard-arrow-down-rounded] text-lg" />
        </button>
      </div>
    </div>
  </div>
</template>
