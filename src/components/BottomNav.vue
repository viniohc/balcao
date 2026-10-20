<script setup lang="ts">
const tabs = [
  { to: '/sale', label: 'Venda' },
  { to: '/commands', label: 'Comandas' },
  { to: '/calls', label: 'Chamar' },
  { to: '/history', label: 'Historico' },
  { to: '/report', label: 'Relatorio' },
  { to: '/products', label: 'Produtos' },
  { to: '/fairs', label: 'Feira' },
]
</script>

<template>
  <nav class="fixed inset-x-0 bottom-0 z-40 overflow-x-auto border-t border-slate-200 bg-white/95 px-2 py-2 shadow-[0_-8px_30px_rgba(15,23,42,0.08)] backdrop-blur md:sticky md:top-0 md:mx-auto md:mt-4 md:max-w-3xl md:rounded-xl md:border md:shadow-lg">
    <div class="grid min-w-[560px] grid-cols-7 gap-1 md:min-w-0">
      <RouterLink
        v-for="tab in tabs"
        :key="tab.to"
        :to="tab.to"
        class="rounded-lg px-1 py-3 text-center text-xs font-semibold text-slate-500 transition sm:text-sm"
        active-class="bg-slate-950 text-white"
      >
        {{ tab.label }}
      </RouterLink>
    </div>
  </nav>
</template>
