<script setup lang="ts">
defineProps<{
  label: string
  value: string
}>()
</script>

<template>
  <article class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
    <p class="text-xs font-bold uppercase tracking-wide text-slate-500">{{ label }}</p>
    <p class="mt-1 text-2xl font-black text-slate-950">{{ value }}</p>
  </article>
</template>
