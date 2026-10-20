<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import type { CartItem, CommandStatus, Fair, PaymentMethod, Product, ProductCategory, Sale } from '@/types/models'
import { DEMO_CREDENTIALS, hasDemoSession, loginDemo, logoutDemo } from '@/demo/auth'
import { clearDemoSelectedFairId, readDemoSelectedFairId, writeDemoSelectedFairId } from '@/demo/storage'
import {
  cancelDemoSale, createDemoFair, createDemoProduct, createDemoSale, deleteDemoFair,
  deleteDemoProduct, demoCategories, readDemoSnapshot, renameDemoFair, saveDemoSettings,
  updateDemoCommandStatus, updateDemoProduct,
} from '@/demo/repository'
import { initializeDemoDatabase, resetDemoDatabase } from '@/demo/database'

import DemoIcon from '@/demo/DemoIcon.vue'

type Page = 'sale' | 'commands' | 'history' | 'products' | 'settings'
const page = ref<Page>('sale')
const authenticated = ref(false)
const ready = ref(false)
const busy = ref(false)
const error = ref('')
const notice = ref('')
const search = ref('')
const categoryFilter = ref('Todas')
const commandFilter = ref<'open' | 'all' | 'done'>('open')
const email = ref('')
const password = ref('')
const fairs = ref<Fair[]>([])
const selectedFairId = ref(readDemoSelectedFairId() ?? 'demo-feira-praca')
const products = ref<Product[]>([])
const sales = ref<Sale[]>([])
const storeName = ref('')
const fairName = ref('')
const productName = ref('')
const productPrice = ref<string | number>('')
const productCategory = ref<ProductCategory>('Comidas')
const editingProductId = ref('')
const cart = ref<CartItem[]>([])
const paymentMethod = ref<PaymentMethod>('pix')
const asCommand = ref(false)
const observation = ref('')

const fair = computed(() => fairs.value.find((item) => item.id === selectedFairId.value))
const availableProducts = computed(() => products.value.filter((item) => item.active && !item.deleted))
const filteredProducts = computed(() => availableProducts.value.filter((product) =>
  (categoryFilter.value === 'Todas' || product.category === categoryFilter.value) &&
  product.name.toLocaleLowerCase('pt-BR').includes(search.value.toLocaleLowerCase('pt-BR')),
))
const categories = computed(() => ['Todas', ...new Set(availableProducts.value.map((product) => product.category))])
const managedProducts = computed(() => products.value.filter((product) => !product.deleted))
const itemCount = computed(() => cart.value.reduce((sum, item) => sum + item.quantity, 0))
const quantityFor = (id: string) => cart.value.find((item) => item.productId === id)?.quantity ?? 0
const commands = computed(() => sales.value.filter((sale) => sale.commandNumber && sale.status === 'confirmado'))
const openCommandCount = computed(() => commands.value.filter((sale) => sale.commandStatus !== 'entregue').length)
const filteredCommands = computed(() => commands.value.filter((sale) =>
  commandFilter.value === 'all' || (commandFilter.value === 'done' ? sale.commandStatus === 'entregue' : sale.commandStatus !== 'entregue'),
))
const confirmedTotal = computed(() => sales.value.filter((sale) => sale.status === 'confirmado').reduce((sum, sale) => sum + sale.total, 0))
const history = computed(() => sales.value.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
const total = computed(() => cart.value.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0))
const paymentLabel = (method: PaymentMethod) => ({ pix: 'Pix', cash: 'Dinheiro', card: 'Cartão' }[method])
const money = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
const date = (value: string) => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
const commandLabel = (status?: CommandStatus) => ({
  pendente: 'Aguardando preparo', preparando: 'Em preparo', pronto: 'Pronta para retirada',
  chamado: 'Cliente chamado', entregue: 'Retirada concluída',
}[status ?? 'pendente'])

const refresh = async (preferred = selectedFairId.value) => {
  const result = await readDemoSnapshot(preferred)
  fairs.value = result.fairs
  selectedFairId.value = result.selectedFairId
  products.value = result.products
  sales.value = result.sales
  storeName.value = result.settings?.storeName ?? ''
  if (result.selectedFairId) writeDemoSelectedFairId(result.selectedFairId)
  else clearDemoSelectedFairId()
}

onMounted(async () => {
  try {
    await initializeDemoDatabase()
    authenticated.value = hasDemoSession()
    if (authenticated.value) await refresh()
  } catch {
    error.value = 'Não foi possível abrir o armazenamento local da demonstração.'
  } finally {
    ready.value = true
  }
})

const signIn = async () => {
  error.value = ''
  if (!loginDemo(email.value, password.value)) {
    error.value = 'Use as credenciais fictícias exibidas abaixo.'
    return
  }
  authenticated.value = true
  await refresh()
}
const signOut = () => {
  logoutDemo()
  authenticated.value = false
  cart.value = []
}
const chooseFair = async (id: string) => {
  cart.value = []
  search.value = ''
  categoryFilter.value = 'Todas'
  clearProductForm()
  error.value = ''
  notice.value = ''
  writeDemoSelectedFairId(id)
  await refresh(id)
}
const restore = async () => {
  if (!window.confirm('Restaurar os dados fictícios iniciais? As alterações serão apagadas somente neste navegador.')) return
  busy.value = true
  try {
    await resetDemoDatabase()
    cart.value = []
    asCommand.value = false
    observation.value = ''
    paymentMethod.value = 'pix'
    await refresh('demo-feira-praca')
    page.value = 'sale'
    search.value = ''
    categoryFilter.value = 'Todas'
    commandFilter.value = 'open'
    clearProductForm()
    error.value = ''
    notice.value = 'Os dados fictícios iniciais foram restaurados.'
  } catch {
    error.value = 'Não foi possível restaurar a demonstração.'
  } finally {
    busy.value = false
  }
}
const addFair = async () => {
  try {
    const created = await createDemoFair(fairName.value)
    fairName.value = ''
    await refresh(created.id)
    notice.value = 'Feira fictícia criada neste navegador.'
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Não foi possível criar a feira.'
  }
}
const renameFair = async () => {
  if (!fair.value) return
  const name = window.prompt('Novo nome da feira:', fair.value.name)
  if (name === null) return
  await renameDemoFair(fair.value.id, name)
  await refresh(fair.value.id)
}
const removeFair = async () => {
  if (!fair.value || !window.confirm('Excluir esta feira e seus dados fictícios somente desta demonstração?')) return
  await deleteDemoFair(fair.value.id)
  cart.value = []
  await refresh()
}
const saveProduct = async () => {
  const price = Number(String(productPrice.value).replace(',', '.'))
  if (!selectedFairId.value || !productName.value.trim() || !Number.isFinite(price) || price < 0) {
    error.value = 'Informe um nome e um preço válido.'
    return
  }
  try {
    if (editingProductId.value) {
      await updateDemoProduct(selectedFairId.value, editingProductId.value, {
        name: productName.value, price, category: productCategory.value,
      })
    } else {
      await createDemoProduct(selectedFairId.value, {
        name: productName.value, price, category: productCategory.value,
      })
    }
    productName.value = ''
    productPrice.value = ''
    editingProductId.value = ''
    await refresh()
    notice.value = 'Produto salvo nesta demonstração.'
    error.value = ''
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Não foi possível salvar o produto.'
  }
}
const editProduct = (product: Product) => {
  editingProductId.value = product.id
  productName.value = product.name
  productPrice.value = String(product.price)
  productCategory.value = product.category
  void nextTick(() => document.getElementById('product-name')?.focus())
}
const removeProduct = async (product: Product) => {
  if (!window.confirm('Excluir este produto fictício somente desta demonstração?')) return
  await deleteDemoProduct(product.fairId, product.id)
  await refresh()
}
const addToCart = (product: Product) => {
  const existing = cart.value.find((item) => item.productId === product.id)
  if (existing) {
    existing.quantity += 1
    existing.total = existing.unitPrice * existing.quantity
  } else {
    cart.value.push({
      lineId: product.id, productId: product.id, productName: product.name,
      unitPrice: product.price, quantity: 1, total: product.price,
    })
  }
}
const adjust = (item: CartItem, amount: number) => {
  item.quantity += amount
  if (item.quantity <= 0) cart.value = cart.value.filter((line) => line.lineId !== item.lineId)
  else item.total = item.unitPrice * item.quantity
}
const checkout = async () => {
  if (busy.value || !selectedFairId.value || !cart.value.length) return
  busy.value = true
  error.value = ''
  try {
    const created = await createDemoSale({
      fairId: selectedFairId.value, items: cart.value, paymentMethod: paymentMethod.value,
      commandNumber: asCommand.value ? 'D-' + String(100 + sales.value.length) : undefined,
      observation: observation.value,
    })
    cart.value = []
    asCommand.value = false
    observation.value = ''
    await refresh()
    notice.value = created.commandNumber ? 'Comanda ' + created.commandNumber + ' registrada neste navegador.' : 'Venda registrada neste navegador. Nenhum pagamento foi processado.'
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Não foi possível registrar.'
  } finally {
    busy.value = false
  }
}
const cancel = async (sale: Sale) => {
  if (!window.confirm('Cancelar esta venda fictícia?')) return
  await cancelDemoSale(sale.fairId, sale.id)
  await refresh()
}
const commandStatus = async (sale: Sale, status: CommandStatus) => {
  await updateDemoCommandStatus(sale.fairId, sale.id, status)
  await refresh()
}
const saveSettings = async () => {
  if (!selectedFairId.value) return
  await saveDemoSettings(selectedFairId.value, storeName.value)
  await refresh()
  notice.value = 'Nome do caixa salvo nesta demonstração.'
}
const pages: Array<{ id: Page; label: string }> = [
  { id: 'sale', label: 'Venda' }, { id: 'commands', label: 'Comandas' },
  { id: 'history', label: 'Histórico' }, { id: 'products', label: 'Produtos' },
  { id: 'settings', label: 'Feira' },
]
const clearProductForm = () => {
  editingProductId.value = ''
  productName.value = ''
  productPrice.value = ''
  productCategory.value = 'Comidas'
}
const navigate = (destination: Page) => {
  page.value = destination
  error.value = ''
  notice.value = ''
}
const fillDemoAccess = () => {
  email.value = DEMO_CREDENTIALS.email
  password.value = DEMO_CREDENTIALS.password
}
const pageTitle = computed(() => ({ sale: 'Nova venda', commands: 'Comandas', history: 'Histórico', products: 'Produtos', settings: 'Minha feira' }[page.value]))
const pageIcons = { sale: 'receipt', commands: 'bell', history: 'history', products: 'box', settings: 'store' } as const
</script>

<template>
  <div class="portfolio-demo" :class="{ 'has-cart': authenticated && page === 'sale' && cart.length }">
    <main v-if="!ready" class="loading-view" aria-live="polite"><DemoIcon name="store" /><h1>Abrindo a demonstração</h1><p>Preparando os dados fictícios deste navegador…</p></main>

    <main v-else-if="!authenticated" class="login-layout">
      <header class="login-brand"><DemoIcon name="store" class="brand-mark" /><span class="wordmark">Balcão</span><span class="demo-label">Demonstração</span></header>
      <div class="login-columns">
        <section class="login-intro">
          <h1>Do balcão<br>à última retirada.</h1>
          <p>Vendas e comandas para feiras e eventos.</p>
          <dl class="demo-facts">
            <div><dt>Para experimentar</dt><dd>Vendas, produtos, chamadas e retiradas.</dd></div>
            <div><dt>Sem cadastro</dt><dd>Entre com o acesso fictício ao lado.</dd></div>
            <div><dt>Liberdade para testar</dt><dd>Altere os exemplos e restaure quando quiser.</dd></div>
          </dl>
          <p class="local-explanation"><DemoIcon name="device" />Dados fictícios, salvos só neste navegador.</p>
        </section>
        <form class="login-form" autocomplete="off" @submit.prevent="signIn">
          <h2>Experimente o Balcão</h2>
          <p>Acesso simulado. Não informe credenciais reais.</p>
          <div class="demo-access">
            <div class="access-heading"><strong>Acesso fictício</strong><button type="button" class="text-action" @click="fillDemoAccess">Preencher campos</button></div>
            <dl><div><dt>E-mail</dt><dd>{{ DEMO_CREDENTIALS.email }}</dd></div><div><dt>Senha</dt><dd>{{ DEMO_CREDENTIALS.password }}</dd></div></dl>
          </div>
          <label class="field">E-mail<input v-model.trim="email" required type="email" autocomplete="off" spellcheck="false" placeholder="demo@feira.local"></label>
          <label class="field">Senha<input v-model="password" required type="password" autocomplete="off" placeholder="Digite a senha fictícia"></label>
          <p v-if="error" role="alert" class="feedback error"><DemoIcon name="info" />{{ error }}</p>
          <button class="button primary login-submit">Entrar no Balcão</button>
        </form>
      </div>
    </main>

    <template v-else>
      <a class="skip-link" href="#demo-content">Ir para o conteúdo</a>
      <header class="app-topbar">
        <div class="brand"><DemoIcon name="store" class="brand-mark" /><div><span class="wordmark">Balcão</span><span class="demo-label">Demonstração</span></div></div>
        <nav class="app-nav" aria-label="Seções da demonstração">
          <button v-for="item in pages" :key="item.id" type="button" :aria-current="page === item.id ? 'page' : undefined" @click="navigate(item.id)"><DemoIcon :name="pageIcons[item.id]" /><span>{{ item.label }}</span><span v-if="item.id === 'commands' && openCommandCount" class="nav-count" :aria-label="openCommandCount + ' comandas aguardando retirada'">{{ openCommandCount }}</span></button>
        </nav>
        <div class="topbar-actions"><button type="button" class="button quiet restore-button" aria-label="Restaurar os dados fictícios iniciais" :disabled="busy" title="Restaurar os dados fictícios iniciais" @click="restore"><DemoIcon name="reset" /><span>Restaurar<span class="restore-detail"> dados</span></span></button><button type="button" class="button quiet" aria-label="Sair da demonstração" @click="signOut"><DemoIcon name="exit" /><span>Sair</span></button></div>
      </header>
      <div class="workspace">
        <main id="demo-content" class="work-surface" tabindex="-1">
          <header class="page-heading"><div><h1>{{ pageTitle }}</h1><p>{{ storeName || fair?.name || 'Crie uma feira fictícia para começar.' }}</p></div><label class="fair-switch"><span>Feira ativa</span><select aria-label="Feira ativa" :value="selectedFairId" :disabled="!fairs.length" @change="chooseFair(($event.target as HTMLSelectElement).value)"><option v-if="!fairs.length" value="">Crie uma feira para começar</option><option v-for="item in fairs" :key="item.id" :value="item.id">{{ item.name }}</option></select></label></header>
          <p v-if="error" role="alert" class="feedback error"><DemoIcon name="info" />{{ error }}</p>
          <p v-if="notice" role="status" class="feedback success"><DemoIcon name="check" />{{ notice }}</p>
          <div v-if="!fairs.length && page !== 'settings'" class="empty-state"><h2>Sua próxima feira começa aqui</h2><p>Crie uma feira fictícia para cadastrar produtos e testar o caixa.</p><button type="button" class="button primary" @click="navigate('settings')">Criar feira fictícia</button></div>

          <section v-else-if="page === 'sale'" class="sale-layout" aria-label="Balcão de vendas">
            <section class="catalog" aria-labelledby="catalog-title">
              <div class="section-heading"><h2 id="catalog-title">Produtos no balcão</h2><span>{{ availableProducts.length }} disponíveis</span></div>
              <label class="search-field"><DemoIcon name="search" /><input v-model="search" type="search" placeholder="Buscar produto" aria-label="Buscar produto"></label>
              <div class="category-tabs" aria-label="Categorias de produtos"><button v-for="category in categories" :key="category" type="button" :aria-pressed="categoryFilter === category" @click="categoryFilter = category">{{ category }}</button></div>
              <div class="catalog-list"><button v-for="product in filteredProducts" :key="product.id" type="button" class="catalog-product" :aria-label="'Adicionar ' + product.name + ', ' + money(product.price)" @click="addToCart(product)"><span class="product-identity"><strong>{{ product.name }}</strong><span>{{ product.category }}</span></span><span class="product-price">{{ money(product.price) }}</span><span class="product-add" :class="{ selected: quantityFor(product.id) }"><span v-if="quantityFor(product.id)">{{ quantityFor(product.id) }}</span><DemoIcon v-else name="plus" /></span></button></div>
              <div v-if="!filteredProducts.length" class="empty-state"><h3>{{ availableProducts.length ? 'Nenhum produto encontrado' : 'O balcão ainda está vazio' }}</h3><p>{{ availableProducts.length ? 'Tente outro nome ou categoria.' : 'Cadastre um produto fictício para montar o primeiro pedido.' }}</p><button v-if="availableProducts.length" type="button" class="button secondary" @click="search = ''; categoryFilter = 'Todas'">Limpar busca</button><button v-else type="button" class="button secondary" @click="navigate('products')">Cadastrar produto</button></div>
              <p class="catalog-hint"><DemoIcon name="info" />Toque em um produto para adicioná-lo ao pedido.</p>
            </section>
            <section id="pedido-atual" class="order-sheet" aria-labelledby="order-title">
              <header class="order-heading"><div><DemoIcon name="receipt" /><h2 id="order-title">Pedido atual</h2></div><span>{{ itemCount }} {{ itemCount === 1 ? 'item' : 'itens' }}</span></header>
              <ul class="order-lines"><li v-for="item in cart" :key="item.lineId"><div class="order-line-title"><strong>{{ item.productName }}</strong><span>{{ money(item.unitPrice * item.quantity) }}</span></div><div class="order-line-detail"><span>{{ money(item.unitPrice) }} / un.</span><div class="quantity-control"><button type="button" :aria-label="'Remover uma unidade de ' + item.productName" @click="adjust(item, -1)"><DemoIcon name="minus" /></button><span>{{ item.quantity }}</span><button type="button" :aria-label="'Adicionar uma unidade de ' + item.productName" @click="adjust(item, 1)"><DemoIcon name="plus" /></button></div></div></li></ul>
              <div v-if="!cart.length" class="empty-order"><DemoIcon name="receipt" /><p>Seu pedido começa no balcão.</p><span>Escolha um produto para continuar.</span></div>
              <div class="order-total"><span>Total do pedido</span><strong>{{ money(total) }}</strong></div>
              <fieldset class="payment-options"><legend>Forma de pagamento</legend><label v-for="method in (['pix', 'cash', 'card'] as const)" :key="method" :class="{ checked: paymentMethod === method }"><input v-model="paymentMethod" type="radio" name="demo-payment" :value="method"><span>{{ paymentLabel(method) }}</span></label></fieldset>
              <label class="command-toggle"><input v-model="asCommand" type="checkbox"><span><strong>Registrar como comanda</strong><span>Acompanhe a chamada e a retirada.</span></span></label>
              <label v-if="asCommand" class="field observation-field">Observação do pedido <span class="optional">(opcional)</span><textarea v-model="observation" rows="2" placeholder="Ex.: retirar no balcão"></textarea></label>
              <button type="button" class="button primary checkout-button" :disabled="!cart.length || busy" @click="checkout"><DemoIcon :name="asCommand ? 'bell' : 'check'" />{{ busy ? 'Registrando…' : asCommand ? 'Registrar comanda' : 'Concluir venda' }}</button>
              <p class="order-footnote">{{ cart.length ? 'Nenhum pagamento será processado.' : 'Adicione um produto para concluir a venda.' }}</p>
            </section>
          </section>

          <section v-else-if="page === 'commands'" class="operation-panel" aria-label="Preparo, chamada e retirada">
            <div class="section-heading"><h2>Preparo e retirada</h2><span>{{ openCommandCount }} aguardando retirada</span></div>
            <div class="category-tabs command-tabs" aria-label="Filtrar comandas"><button type="button" :aria-pressed="commandFilter === 'open'" @click="commandFilter = 'open'">A retirar</button><button type="button" :aria-pressed="commandFilter === 'done'" @click="commandFilter = 'done'">Concluídas</button><button type="button" :aria-pressed="commandFilter === 'all'" @click="commandFilter = 'all'">Todas</button></div>
            <div class="command-list"><article v-for="sale in filteredCommands" :key="sale.id" class="command-ticket"><div class="command-number"><span>Comanda</span><h3>{{ sale.commandNumber }}</h3><span>{{ money(sale.total) }}</span></div><div class="command-content"><p class="status-tag" :class="{ ready: sale.commandStatus === 'pronto' || sale.commandStatus === 'chamado', completed: sale.commandStatus === 'entregue' }">{{ commandLabel(sale.commandStatus) }}</p><ul><li v-for="item in sale.items" :key="item.lineId"><span class="item-quantity">{{ item.quantity }}×</span>{{ item.productName }}</li></ul><p v-if="sale.observation" class="order-observation">{{ sale.observation }}</p></div><div class="command-actions"><button type="button" class="button secondary" :disabled="sale.commandStatus === 'chamado' || sale.commandStatus === 'entregue'" @click="commandStatus(sale, 'chamado')"><DemoIcon name="bell" />Chamar pedido</button><button type="button" class="button secondary" :disabled="sale.commandStatus === 'entregue'" @click="commandStatus(sale, 'entregue')"><DemoIcon name="check" />Marcar retirada</button></div></article></div>
            <div v-if="!filteredCommands.length" class="empty-state"><h3>{{ commandFilter === 'done' ? 'Nenhuma retirada concluída' : 'Nenhuma comanda nesta lista' }}</h3><p>{{ commandFilter === 'done' ? 'As comandas entregues aparecerão aqui.' : 'Registre uma venda como comanda para acompanhar o pedido até a retirada.' }}</p><button type="button" class="button secondary" @click="navigate('sale'); asCommand = true">Criar uma comanda</button></div>
          </section>

          <section v-else-if="page === 'history'" class="operation-panel" aria-labelledby="history-title">
            <div class="section-heading history-heading"><div><h2 id="history-title">Movimento da feira</h2><p>{{ history.length }} {{ history.length === 1 ? 'registro' : 'registros' }} neste navegador</p></div><div class="history-total"><span>Total confirmado</span><strong>{{ money(confirmedTotal) }}</strong></div></div>
            <table v-if="history.length" class="history-table"><caption class="sr-only">Vendas e comandas fictícias da feira ativa</caption><thead><tr><th scope="col">Pedido</th><th scope="col">Data e hora</th><th scope="col">Pagamento</th><th scope="col">Situação</th><th scope="col" class="numeric">Total</th><th scope="col"><span class="sr-only">Ação</span></th></tr></thead><tbody><tr v-for="sale in history" :key="sale.id"><td class="sale-identity"><strong>{{ sale.commandNumber ? 'Comanda ' + sale.commandNumber : 'Venda no balcão' }}</strong><span>{{ sale.items.map((item) => item.quantity + '× ' + item.productName).join(', ') }}</span></td><td data-label="Data e hora">{{ date(sale.createdAt) }}</td><td data-label="Pagamento">{{ paymentLabel(sale.paymentMethod) }}</td><td data-label="Situação"><span class="status-tag" :class="{ cancelled: sale.status === 'cancelado' }">{{ sale.status === 'cancelado' ? 'Cancelada' : 'Confirmada' }}</span></td><td data-label="Total" class="numeric sale-total">{{ money(sale.total) }}</td><td class="row-action"><button v-if="sale.status === 'confirmado'" type="button" class="text-action danger" @click="cancel(sale)">Cancelar venda</button></td></tr></tbody></table>
            <div v-else class="empty-state"><h3>O caixa ainda não tem movimento</h3><p>As vendas e comandas registradas nesta feira aparecerão aqui.</p><button type="button" class="button secondary" @click="navigate('sale')">Registrar primeira venda</button></div>
          </section>

          <section v-else-if="page === 'products'" class="products-layout" aria-label="Cadastro de produtos">
            <section class="operation-panel" aria-labelledby="products-title"><div class="section-heading"><h2 id="products-title">Catálogo da feira</h2><span>{{ managedProducts.length }} {{ managedProducts.length === 1 ? 'produto' : 'produtos' }}</span></div><div class="product-list-head"><span>Produto</span><span class="numeric">Preço</span><span>Ações</span></div><div class="managed-products"><article v-for="product in managedProducts" :key="product.id" class="managed-product"><div class="product-identity"><strong>{{ product.name }}</strong><span>{{ product.category }}{{ product.active ? '' : ' — Inativo' }}</span></div><span class="product-price">{{ money(product.price) }}</span><div class="product-actions"><button type="button" class="text-action" :aria-label="'Editar ' + product.name" @click="editProduct(product)">Editar</button><button type="button" class="text-action danger" :aria-label="'Excluir ' + product.name" @click="removeProduct(product)">Excluir</button></div></article></div><div v-if="!managedProducts.length" class="empty-state"><h3>Seu catálogo começa aqui</h3><p>Cadastre o nome, o preço e a categoria do primeiro produto fictício.</p><a href="#product-name" class="text-action">Cadastrar primeiro produto</a></div></section>
            <form class="product-editor" @submit.prevent="saveProduct"><h2>{{ editingProductId ? 'Editar produto' : 'Novo produto' }}</h2><p>{{ editingProductId ? 'A alteração vale só para esta demonstração.' : 'Cadastre um item fictício para vender no balcão.' }}</p><label class="field">Nome do produto<input id="product-name" v-model.trim="productName" required placeholder="Ex.: Suco de maracujá"></label><div class="product-form-row"><label class="field">Preço (R$)<input v-model="productPrice" required type="number" min="0" step="0.01" inputmode="decimal" placeholder="0,00"></label><label class="field">Categoria<select v-model="productCategory"><option v-for="category in demoCategories" :key="category">{{ category }}</option></select></label></div><button class="button primary">{{ editingProductId ? 'Salvar alteração' : 'Cadastrar produto' }}</button><button v-if="editingProductId" type="button" class="button quiet" @click="clearProductForm">Cancelar edição</button></form>
          </section>

          <section v-else class="settings-layout" aria-label="Configurações da feira">
            <section class="settings-row"><div><h2>Nome no caixa</h2><p>É o nome exibido no balcão desta feira.</p></div><form @submit.prevent="saveSettings"><label class="field">Nome do estabelecimento<input v-model.trim="storeName" required></label><button class="button primary" :disabled="!selectedFairId">Salvar configuração</button></form></section>
            <section class="settings-row"><div><h2>Outra feira, outro caixa</h2><p>Cada feira tem seus próprios produtos, vendas e comandas fictícios.</p></div><form @submit.prevent="addFair"><label class="field">Nome da nova feira<input v-model.trim="fairName" required placeholder="Ex.: Feira do Coreto"></label><button class="button secondary">Criar feira fictícia</button></form></section>
            <section v-if="fair" class="settings-row administration"><div><h2>Administrar esta feira</h2><p>{{ fair.name }}</p></div><div class="administration-actions"><button type="button" class="button secondary" @click="renameFair">Renomear feira</button><button type="button" class="button secondary danger" @click="removeFair">Excluir feira</button><p>A exclusão remove só os dados fictícios desta feira, neste navegador. Você pode restaurar os exemplos no topo da página.</p></div></section>
          </section>
          <footer class="workspace-footer">Dados fictícios, salvos só neste navegador.</footer>
        </main>
      </div>
      <a v-if="page === 'sale' && cart.length" class="mobile-order-link" href="#pedido-atual"><DemoIcon name="receipt" /><span>Ver pedido <strong>{{ itemCount }} {{ itemCount === 1 ? 'item' : 'itens' }}</strong></span><strong>{{ money(total) }}</strong></a>
    </template>
  </div>
</template>
