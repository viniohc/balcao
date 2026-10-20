<script setup lang="ts">
import { onMounted, ref } from 'vue'
import ProductForm from '@/components/ProductForm.vue'
import { formatCurrency } from '@/services/currency'
import { useProductsStore } from '@/stores/products'
import type { Product } from '@/types/models'

const productsStore = useProductsStore()
const editingProduct = ref<Product | undefined>()
const formOpen = ref(false)

onMounted(async () => {
  if (productsStore.products.length === 0) {
    await productsStore.loadProducts()
  }
})

const openNewProduct = () => {
  editingProduct.value = undefined
  formOpen.value = true
}

const editProduct = (product: Product) => {
  editingProduct.value = product
  formOpen.value = true
}

const closeForm = () => {
  editingProduct.value = undefined
  formOpen.value = false
}

const saveProduct = async (payload: Parameters<typeof productsStore.saveProduct>[0]) => {
  await productsStore.saveProduct(payload)
  closeForm()
}

const deleteProduct = async (product: Product) => {
  if (window.confirm(`Excluir ${product.name} do cadastro? As vendas antigas continuam no histórico.`)) {
    await productsStore.deleteProduct(product)
  }
}
</script>

<template>
  <section class="mx-auto min-h-dvh max-w-4xl px-4 py-4">
    <header class="mb-4 flex items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-black">Produtos</h1>
        <p class="text-sm font-semibold text-slate-500">Cadastro da feira</p>
      </div>
      <button type="button" class="rounded-lg bg-slate-950 px-4 py-3 text-sm font-black text-white" @click="openNewProduct">
        Novo
      </button>
    </header>

    <ProductForm v-if="formOpen" class="mb-4" :product="editingProduct" @save="saveProduct" @cancel="closeForm" />
    <p v-if="productsStore.realtimeError" class="mb-3 rounded-lg bg-amber-50 p-3 text-sm font-bold text-amber-800">
      Realtime indisponivel: {{ productsStore.realtimeError }}
    </p>

    <div class="space-y-3">
      <article
        v-for="product in productsStore.products"
        :key="product.id"
        class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
      >
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="text-lg font-black text-slate-950">{{ product.name }}</p>
            <p class="text-sm font-bold text-slate-500">{{ product.category }} · ordem {{ product.sortOrder }}</p>
          </div>
          <div class="text-right">
            <p class="text-lg font-black text-emerald-700">{{ formatCurrency(product.price) }}</p>
            <span class="rounded-full px-2 py-1 text-xs font-bold" :class="product.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'">
              {{ product.active ? 'Ativo' : 'Inativo' }}
            </span>
          </div>
        </div>
        <div class="mt-4 grid grid-cols-3 gap-2">
          <button type="button" class="rounded-lg border border-slate-200 py-3 text-sm font-black" @click="editProduct(product)">
            Editar
          </button>
          <button type="button" class="rounded-lg bg-slate-100 py-3 text-sm font-black text-slate-700" @click="productsStore.toggleProduct(product)">
            {{ product.active ? 'Desativar' : 'Ativar' }}
          </button>
          <button type="button" class="rounded-lg bg-red-50 py-3 text-sm font-black text-red-700" @click="deleteProduct(product)">
            Excluir
          </button>
        </div>
      </article>
    </div>
  </section>
</template>
