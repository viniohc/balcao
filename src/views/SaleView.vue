<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import CartDrawer from '@/components/CartDrawer.vue'
import CartSummary from '@/components/CartSummary.vue'
import OfflineBadge from '@/components/OfflineBadge.vue'
import ProductCard from '@/components/ProductCard.vue'
import { todayLabel } from '@/services/date'
import { productCategories, useProductsStore } from '@/stores/products'
import { useCartStore } from '@/stores/cart'
import { useFairsStore } from '@/stores/fairs'
import { useSalesStore } from '@/stores/sales'
import { useSettingsStore } from '@/stores/settings'
import type { ProductCategory } from '@/types/models'
import { APP_STORAGE_KEYS } from '@/services/storage'

type SaleCategory = 'Todos' | ProductCategory

const router = useRouter()
const productsStore = useProductsStore()
const cartStore = useCartStore()
const fairsStore = useFairsStore()
const salesStore = useSalesStore()
const settingsStore = useSettingsStore()
const selectedCategory = ref<SaleCategory>('Todos')
const drawerOpen = ref(false)
const observationOpen = ref(false)
const savedMessage = ref(false)
const syncError = ref('')
const syncing = ref(false)

const categories: SaleCategory[] = ['Todos', ...productCategories]

const products = computed(() =>
  selectedCategory.value === 'Todos'
    ? productsStore.activeProducts
    : productsStore.activeProducts.filter((product) => product.category === selectedCategory.value),
)
const hasObservation = computed(() => cartStore.observation.trim().length > 0)

const goToCheckout = () => {
  if (!cartStore.isEmpty) {
    router.push('/checkout')
  }
}

const syncNow = async () => {
  syncError.value = ''
  syncing.value = true

  try {
    await fairsStore.syncSelectedFairToCloud()
    await Promise.all([
      productsStore.loadProducts(),
      salesStore.loadSales(),
      settingsStore.loadSettings(),
    ])
  } catch (error) {
    syncError.value = error instanceof Error ? error.message : 'Não foi possível sincronizar.'
  } finally {
    syncing.value = false
  }
}

onMounted(async () => {
  await productsStore.loadProducts()

  if (sessionStorage.getItem(APP_STORAGE_KEYS.saleSaved) === '1') {
    sessionStorage.removeItem(APP_STORAGE_KEYS.saleSaved)
    savedMessage.value = true
    window.setTimeout(() => {
      savedMessage.value = false
    }, 1800)
  }
})
</script>

<template>
  <section class="min-h-dvh pb-44 md:pb-32">
    <header class="sticky top-0 z-20 border-b border-slate-200 bg-slate-50/95 px-4 py-3 backdrop-blur">
      <div class="mx-auto flex max-w-2xl items-center justify-between gap-3 md:max-w-6xl">
        <div>
          <h1 class="text-xl font-black leading-tight">Caixa da Feira</h1>
          <p class="text-sm font-semibold text-slate-500">{{ fairsStore.selectedFair?.name ?? 'Feira' }} · {{ todayLabel() }}</p>
        </div>
        <div class="flex items-center gap-2">
          <button type="button" class="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-700 shadow-sm disabled:opacity-50" :disabled="syncing" @click="syncNow">
            {{ syncing ? 'Sync...' : 'Sync' }}
          </button>
          <OfflineBadge />
        </div>
      </div>
    </header>

    <div v-if="fairsStore.syncMessage || syncError" class="mx-auto mt-3 max-w-2xl px-4">
      <div class="rounded-lg px-4 py-3 text-center text-sm font-black" :class="syncError ? 'bg-red-50 text-red-700' : 'bg-slate-900 text-white'">
        {{ syncError || fairsStore.syncMessage }}
      </div>
    </div>

    <div v-if="savedMessage" class="mx-auto mt-3 max-w-2xl px-4">
      <div class="rounded-lg bg-emerald-600 px-4 py-3 text-center font-black text-white shadow-lg">
        Venda salva
      </div>
    </div>

    <div class="mx-auto max-w-2xl px-4 py-4 md:max-w-6xl">
      <div class="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2">
        <button
          v-for="category in categories"
          :key="category"
          type="button"
          class="shrink-0 rounded-full border px-4 py-2 text-sm font-black"
          :class="selectedCategory === category ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-200 bg-white text-slate-700'"
          @click="selectedCategory = category"
        >
          {{ category }}
        </button>
      </div>

      <div class="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <ProductCard
          v-for="product in products"
          :key="product.id"
          :product="product"
          :quantity="cartStore.getQuantity(product.id)"
          @add="cartStore.addProduct"
        />
      </div>

      <p v-if="products.length === 0" class="mt-12 text-center font-semibold text-slate-500">
        Nenhum produto ativo nesta categoria.
      </p>
    </div>

    <CartSummary
      v-model:command-number="cartStore.commandNumber"
      :total="cartStore.total"
      :item-count="cartStore.itemCount"
      :disabled="cartStore.isEmpty"
      :has-observation="hasObservation"
      @open="drawerOpen = true"
      @observation="observationOpen = true"
      @checkout="goToCheckout"
    />

    <CartDrawer
      :open="drawerOpen"
      :items="cartStore.items"
      :total="cartStore.total"
      @close="drawerOpen = false"
      @increment="cartStore.setQuantity"
      @decrement="cartStore.setQuantity"
      @remove="(productId) => cartStore.setQuantity(productId, 0)"
    />

    <div v-if="observationOpen" class="fixed inset-0 z-40 bg-slate-950/40 px-4 py-6" @click.self="observationOpen = false">
      <section class="mx-auto mt-20 max-w-lg rounded-xl bg-white p-4 shadow-2xl">
        <header class="mb-3 flex items-center justify-between gap-3">
          <h2 class="text-xl font-black text-slate-950">Observação do pedido</h2>
          <button type="button" class="rounded-lg bg-slate-100 px-3 py-2 text-sm font-black text-slate-700" @click="observationOpen = false">
            Fechar
          </button>
        </header>

        <textarea
          v-model.trim="cartStore.observation"
          class="min-h-36 w-full resize-none rounded-lg border border-slate-300 p-3 text-base font-semibold text-slate-950 outline-none focus:border-slate-950"
          maxlength="300"
          placeholder="Ex: sem cebola, separar molho, entregar na mesa 4"
        />

        <div class="mt-3 flex items-center justify-between gap-3">
          <button type="button" class="rounded-lg bg-slate-100 px-4 py-3 text-sm font-black text-slate-700" @click="cartStore.observation = ''">
            Limpar
          </button>
          <button type="button" class="rounded-lg bg-slate-950 px-5 py-3 text-sm font-black text-white" @click="observationOpen = false">
            Salvar
          </button>
        </div>
      </section>
    </div>
  </section>
</template>
