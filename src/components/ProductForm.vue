<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import { productCategories } from '@/stores/products'
import type { Product, ProductCategory } from '@/types/models'

const props = defineProps<{
  product?: Product
}>()

const emit = defineEmits<{
  save: [payload: {
    id?: string
    name: string
    price: number
    category: ProductCategory
    active: boolean
    sortOrder: number
  }]
  cancel: []
}>()

const form = reactive({
  id: undefined as string | undefined,
  name: '',
  price: 0,
  category: 'Comidas' as ProductCategory,
  active: true,
  sortOrder: 1,
})

const title = computed(() => (form.id ? 'Editar produto' : 'Novo produto'))

watch(
  () => props.product,
  (product) => {
    form.id = product?.id
    form.name = product?.name ?? ''
    form.price = product?.price ?? 0
    form.category = product?.category ?? 'Comidas'
    form.active = product?.active ?? true
    form.sortOrder = product?.sortOrder ?? 1
  },
  { immediate: true },
)

const submit = () => {
  emit('save', {
    id: form.id,
    name: form.name,
    price: Math.max(0, Number(form.price)),
    category: form.category,
    active: form.active,
    sortOrder: Number(form.sortOrder),
  })
}
</script>

<template>
  <form class="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm" @submit.prevent="submit">
    <h2 class="text-lg font-black">{{ title }}</h2>
    <label class="block">
      <span class="text-sm font-bold text-slate-600">Nome</span>
      <input v-model.trim="form.name" required class="mt-1 h-12 w-full rounded-lg border border-slate-300 px-3 font-semibold outline-none focus:border-slate-950">
    </label>
    <div class="grid grid-cols-2 gap-3">
      <label class="block">
        <span class="text-sm font-bold text-slate-600">Preço</span>
        <input v-model.number="form.price" required min="0" step="0.01" type="number" class="mt-1 h-12 w-full rounded-lg border border-slate-300 px-3 font-semibold outline-none focus:border-slate-950">
      </label>
      <label class="block">
        <span class="text-sm font-bold text-slate-600">Ordem</span>
        <input v-model.number="form.sortOrder" required min="0" type="number" class="mt-1 h-12 w-full rounded-lg border border-slate-300 px-3 font-semibold outline-none focus:border-slate-950">
      </label>
    </div>
    <label class="block">
      <span class="text-sm font-bold text-slate-600">Categoria</span>
      <select v-model="form.category" class="mt-1 h-12 w-full rounded-lg border border-slate-300 px-3 font-semibold outline-none focus:border-slate-950">
        <option v-for="category in productCategories" :key="category" :value="category">{{ category }}</option>
      </select>
    </label>
    <label class="flex items-center justify-between rounded-lg bg-slate-50 p-3 font-bold">
      <span>Produto ativo</span>
      <input v-model="form.active" type="checkbox" class="h-5 w-5 accent-slate-950">
    </label>
    <div class="grid grid-cols-2 gap-2">
      <button type="button" class="rounded-lg border border-slate-200 py-3 font-black" @click="$emit('cancel')">
        Cancelar
      </button>
      <button type="submit" class="rounded-lg bg-slate-950 py-3 font-black text-white">
        Salvar
      </button>
    </div>
  </form>
</template>
