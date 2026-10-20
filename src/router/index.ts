import { createRouter, createWebHistory } from 'vue-router'
import SaleView from '@/views/SaleView.vue'
import CheckoutView from '@/views/CheckoutView.vue'
import HistoryView from '@/views/HistoryView.vue'
import ReportView from '@/views/ReportView.vue'
import ProductsView from '@/views/ProductsView.vue'
import FairsView from '@/views/FairsView.vue'
import LoginView from '@/views/LoginView.vue'
import CommandsView from '@/views/CommandsView.vue'
import CallsView from '@/views/CallsView.vue'
import { useAuthStore } from '@/stores/auth'
import { useFairsStore } from '@/stores/fairs'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/sale' },
    { path: '/login', name: 'login', component: LoginView, meta: { public: true, hideNav: true } },
    { path: '/fairs', name: 'fairs', component: FairsView, meta: { hideNav: true } },
    { path: '/sale', name: 'sale', component: SaleView },
    { path: '/checkout', name: 'checkout', component: CheckoutView },
    { path: '/commands', name: 'commands', component: CommandsView },
    { path: '/calls', name: 'calls', component: CallsView },
    { path: '/history', name: 'history', component: HistoryView },
    { path: '/report', name: 'report', component: ReportView },
    { path: '/products', name: 'products', component: ProductsView },
  ],
})

router.beforeEach(async (to) => {
  const authStore = useAuthStore()
  const fairsStore = useFairsStore()

  if (!authStore.ready) {
    await authStore.initAuth()
  }

  if (!to.meta.public && !authStore.isAuthenticated) {
    return '/login'
  }

  if (authStore.isAuthenticated && to.path === '/login') {
    return '/fairs'
  }

  if (!to.meta.public && to.path !== '/fairs' && !fairsStore.hasSelectedFair) {
    return '/fairs'
  }
})
