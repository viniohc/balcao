<script setup lang="ts">
withDefaults(defineProps<{ name: string }>(), { name: 'info' })
const paths: Record<string, string> = {
  store: 'M3 10V5h18v5M3 10a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0M5 13v7h14v-7M9 20v-6h6v6M8 5l1 5m7-5-1 5',
  receipt: 'M6 3h12v18l-3-2-3 2-3-2-3 2V3Zm3 5h6m-6 4h6m-6 4h3',
  bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4',
  history: 'M3 11a9 9 0 1 1 2 7M3 4v7h7m2-4v5l3 2',
  box: 'm12 3 9 5-9 5-9-5 9-5Zm-9 5v9l9 5 9-5V8m-9 5v9M7.5 5.5l9 5',
  search: 'M20 20l-5-5m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z',
  plus: 'M12 5v14M5 12h14', minus: 'M5 12h14',
  check: 'm5 12 4 4L19 6', arrow: 'M4 12h16m-6-6 6 6-6 6',
  info: 'M12 11v6m0-10h.01M22 12A10 10 0 1 1 2 12a10 10 0 0 1 20 0Z',
  reset: 'M3 10a9 9 0 1 1 1.5 8M3 4v6h6',
  device: 'M3 4h18v13H3V4Zm5 17h8m-4-4v4',
  exit: 'M9 4H4v16h5m5-12 4 4-4 4m-6-4h12',
}
</script>
<template><svg class="demo-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path :d="paths[name] ?? paths.info" /></svg></template>
