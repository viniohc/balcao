<template>
  <div class="min-h-dvh bg-slate-50 text-slate-950">
    <BottomNav v-if="!route.meta.hideNav" />
    <main class="mx-auto min-h-dvh w-full max-w-6xl pb-24 md:pb-8">
      <RouterView />
    </main>
  </div>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'
import BottomNav from '@/components/BottomNav.vue'

const route = useRoute()
</script>
