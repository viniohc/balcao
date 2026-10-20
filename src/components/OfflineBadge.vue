<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

const online = ref(navigator.onLine)

const updateStatus = () => {
  online.value = navigator.onLine
}

onMounted(() => {
  window.addEventListener('online', updateStatus)
  window.addEventListener('offline', updateStatus)
})

onUnmounted(() => {
  window.removeEventListener('online', updateStatus)
  window.removeEventListener('offline', updateStatus)
})
</script>

<template>
  <span
    class="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold"
    :class="online ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'"
  >
    {{ online ? 'Online' : 'Offline' }}
  </span>
</template>
