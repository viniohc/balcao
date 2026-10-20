<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { seedDatabase } from '@/services/db'
import { useAuthStore } from '@/stores/auth'
import { useCartStore } from '@/stores/cart'
import { useFairsStore } from '@/stores/fairs'
import { useProductsStore } from '@/stores/products'
import { useSalesStore } from '@/stores/sales'
import { useSettingsStore } from '@/stores/settings'

const router = useRouter()
const authStore = useAuthStore()
const fairsStore = useFairsStore()
const productsStore = useProductsStore()
const salesStore = useSalesStore()
const settingsStore = useSettingsStore()
const cartStore = useCartStore()
const newFairName = ref('')
const errorMessage = ref('')
const issueMessage = ref('')
const assignmentTargets = reactive<Record<string, string>>({})

const canManageFair = (ownerId: string) => ownerId === authStore.user?.uid

onMounted(async () => {
  await fairsStore.loadFairs()
  await fairsStore.refreshSyncIssues()
})

const openFair = async (fairId: string) => {
  productsStore.stopRealtime()
  salesStore.stopRealtime()
  await fairsStore.selectFair(fairId)
  cartStore.clearCart()
  await seedDatabase(fairId)
  await Promise.all([
    productsStore.loadProducts(),
    salesStore.loadSales(),
    settingsStore.loadSettings(),
  ])
  await Promise.all([
    productsStore.startRealtime(),
    salesStore.startRealtime(),
  ])
  router.push('/sale')
}

const createFair = async () => {
  errorMessage.value = ''
  try {
    const fair = await fairsStore.createFair(newFairName.value || 'Nova feira')
    newFairName.value = ''
    await openFair(fair.id)
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Não foi possível criar a feira.'
  }
}

const renameFair = async (fairId: string, currentName: string) => {
  const name = window.prompt('Novo nome da feira:', currentName)
  if (name === null) return

  errorMessage.value = ''
  try {
    await fairsStore.renameFair(fairId, name)
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Não foi possível editar a feira.'
    await fairsStore.loadFairs()
  }
}

const deleteFair = async (fairId: string, name: string) => {
  if (!window.confirm(`Excluir a feira "${name}"? Ela não aparecerá mais na lista.`)) return

  errorMessage.value = ''
  try {
    const result = await fairsStore.deleteFair(fairId)
    if (result.status === 'conflict') {
      const proceed = window.confirm('A situação da feira mudou em outro dispositivo. Confirmar a exclusão usando a versão remota atual?')
      if (!proceed) return
      const retry = await fairsStore.deleteFair(fairId)
      if (retry.status === 'conflict') {
        errorMessage.value = 'A feira mudou novamente. Atualize a lista e confirme a exclusão outra vez.'
      }
    }
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Não foi possível excluir a feira.'
    await fairsStore.loadFairs()
  }
}

const legacyKey = (record: { entity: string; id?: string; recordId?: string }) => record.entity + ':' + (record.id ?? record.recordId ?? '')

const entityLabel = (entity: string) => ({
  products: 'Produto',
  sales: 'Venda ou comanda',
  settings: 'Configuração',
}[entity] ?? entity)

const associateLegacy = async (record: { entity: 'products' | 'sales' | 'settings'; id: string }) => {
  const fairId = assignmentTargets[legacyKey(record)]
  const fair = fairsStore.fairs.find((item) => item.id === fairId)
  if (!fair) {
    issueMessage.value = 'Escolha explicitamente a feira correta antes de associar.'
    return
  }

  const confirmed = window.confirm(
    'Associar ' + entityLabel(record.entity) + ' ' + record.id + ' à feira "' + fair.name + '"? A associação ficará local e pendente de sincronização.',
  )
  if (!confirmed) return

  issueMessage.value = ''
  try {
    await fairsStore.associateLegacyData(record, fairId)
    delete assignmentTargets[legacyKey(record)]
  } catch (error) {
    issueMessage.value = error instanceof Error ? error.message : 'Não foi possível associar este registro.'
  }
}

const resolveConflict = async (
  conflict: (typeof fairsStore.syncConflicts)[number],
  resolution: 'local' | 'remote',
) => {
  const choice = resolution === 'local'
    ? 'Manter a versão deste dispositivo e tentar enviá-la'
    : 'Substituir a versão deste dispositivo pela versão remota'
  if (!window.confirm(choice + ' para ' + entityLabel(conflict.entity) + ' ' + conflict.recordId + '?')) return

  issueMessage.value = ''
  try {
    await fairsStore.resolveConflict(conflict, resolution)
  } catch (error) {
    issueMessage.value = error instanceof Error ? error.message : 'Não foi possível resolver o conflito.'
  }
}

const resolveFairConflict = async (
  conflict: (typeof fairsStore.fairMetadataConflicts)[number],
  resolution: 'local' | 'remote',
) => {
  const choice = resolution === 'local'
    ? 'Manter os metadados deste dispositivo e tentar sincronizá-los'
    : 'Substituir os metadados locais pela versão remota'
  if (!window.confirm(choice + ' para a feira ' + conflict.fairId + '?')) return

  issueMessage.value = ''
  try {
    await fairsStore.resolveFairConflict(conflict, resolution)
  } catch (error) {
    issueMessage.value = error instanceof Error ? error.message : 'Não foi possível resolver o conflito da feira.'
  }
}
const logout = async () => {
  productsStore.stopRealtime()
  salesStore.stopRealtime()
  fairsStore.clearSelection()
  await authStore.logout()
  router.push('/login')
}
</script>

<template>
  <section class="mx-auto min-h-dvh max-w-3xl px-4 py-5">
    <header class="mb-5 flex items-start justify-between gap-3">
      <div>
        <h1 class="text-2xl font-black">Escolha a feira</h1>
        <p class="text-sm font-semibold text-slate-500">Produtos, vendas e relatórios ficam separados por feira.</p>
      </div>
      <button type="button" class="rounded-lg bg-white px-3 py-2 text-sm font-black shadow-sm" @click="logout">
        Sair
      </button>
    </header>

    <form class="mb-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm" @submit.prevent="createFair">
      <label class="block">
        <span class="text-sm font-bold text-slate-600">Nova feira/festa</span>
        <input v-model.trim="newFairName" class="mt-1 h-12 w-full rounded-lg border border-slate-300 px-3 font-semibold outline-none focus:border-slate-950" placeholder="Ex: Festa Junina 2026">
      </label>
      <button type="submit" class="mt-3 w-full rounded-lg bg-slate-950 py-3 font-black text-white">
        Criar e usar
      </button>
      <p v-if="errorMessage" class="mt-3 rounded-lg bg-red-50 p-3 text-sm font-bold text-red-700">{{ errorMessage }}</p>
    </form>

    <div class="space-y-3">
      <article
        v-for="fair in fairsStore.fairs"
        :key="fair.id"
        class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        <div class="flex items-start justify-between gap-3">
          <button type="button" class="min-w-0 flex-1 text-left" @click="openFair(fair.id)">
            <span class="block truncate text-lg font-black text-slate-950">{{ fair.name }}</span>
            <span class="text-sm font-semibold text-slate-500">Abrir caixa desta feira</span>
          </button>

          <div v-if="canManageFair(fair.ownerId)" class="grid grid-cols-2 gap-2">
            <button type="button" class="rounded-lg bg-slate-100 px-3 py-2 text-sm font-black text-slate-700" @click="renameFair(fair.id, fair.name)">
              Editar
            </button>
            <button type="button" class="rounded-lg bg-red-50 px-3 py-2 text-sm font-black text-red-700" @click="deleteFair(fair.id, fair.name)">
              Excluir
            </button>
          </div>
        </div>
      </article>
    </div>

    <section v-if="fairsStore.fairMetadataConflicts.length > 0" class="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4">
      <h2 class="text-lg font-black text-amber-950">Conflito nos dados da feira</h2>
      <p class="mt-1 text-sm font-semibold text-amber-900">As duas versões foram preservadas. Confirme qual versão deve continuar.</p>
      <article v-for="conflict in fairsStore.fairMetadataConflicts" :key="conflict.fairId" class="mt-3 rounded-lg bg-white p-3">
        <p class="break-all text-sm font-black">Feira · {{ conflict.fairId }}</p>
        <p class="mt-2 text-sm text-slate-700">Local: {{ conflict.localData.name }} · {{ conflict.localData.active ? 'ativa' : 'inativa' }}</p>
        <p class="text-sm text-slate-700">Remota: {{ conflict.remoteData?.name ?? 'indisponível' }} · {{ conflict.remoteData ? (conflict.remoteData.active ? 'ativa' : 'inativa') : 'indisponível' }}</p>
        <div class="mt-2 flex flex-wrap gap-2">
          <button type="button" class="rounded-lg bg-slate-950 px-3 py-2 text-xs font-black text-white disabled:opacity-40" :disabled="!conflict.remoteData" @click="resolveFairConflict(conflict, 'local')">
            Manter local e enviar
          </button>
          <button type="button" class="rounded-lg bg-white px-3 py-2 text-xs font-black text-slate-700 ring-1 ring-slate-300 disabled:opacity-40" :disabled="!conflict.remoteData" @click="resolveFairConflict(conflict, 'remote')">
            Usar versão remota
          </button>
        </div>
      </article>
    </section>

    <section v-if="fairsStore.syncConflicts.length > 0" class="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4">
      <h2 class="text-lg font-black text-amber-950">Conflitos que precisam de decisão</h2>
      <p class="mt-1 text-sm font-semibold text-amber-900">As duas versões foram preservadas. Escolha qual delas deve continuar; nenhuma será enviada ou aplicada automaticamente.</p>
      <article v-for="conflict in fairsStore.syncConflicts" :key="legacyKey(conflict)" class="mt-3 rounded-lg bg-white p-3">
        <p class="break-all text-sm font-black">{{ entityLabel(conflict.entity) }} · {{ conflict.recordId }}</p>
        <div class="mt-2 flex flex-wrap gap-2">
          <button type="button" class="rounded-lg bg-slate-950 px-3 py-2 text-xs font-black text-white" @click="resolveConflict(conflict, 'local')">
            Manter local e enviar
          </button>
          <button type="button" class="rounded-lg bg-white px-3 py-2 text-xs font-black text-slate-700 ring-1 ring-slate-300 disabled:opacity-40" :disabled="!conflict.remoteExists" @click="resolveConflict(conflict, 'remote')">
            Usar versão remota
          </button>
        </div>
      </article>
    </section>

    <section v-if="fairsStore.legacyRecords.length > 0" class="mt-6 rounded-xl border border-sky-300 bg-sky-50 p-4">
      <h2 class="text-lg font-black text-sky-950">Registros locais sem feira</h2>
      <p class="mt-1 text-sm font-semibold text-sky-900">
        {{ fairsStore.legacyRecords.length }} registro(s) foram preservados sem associação automática. Confira o tipo, o ID e os detalhes locais; escolha a feira somente se reconhecer a origem.
      </p>
      <article v-for="record in fairsStore.legacyRecords" :key="legacyKey(record)" class="mt-3 rounded-lg bg-white p-3">
        <p class="break-all text-sm font-black">{{ entityLabel(record.entity) }} · {{ record.id }}</p>
        <p class="mt-1 break-words text-sm text-slate-600">{{ record.description }}</p>
        <div class="mt-2 flex flex-col gap-2 sm:flex-row">
          <select v-model="assignmentTargets[legacyKey(record)]" class="h-11 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold">
            <option value="">Selecione a feira correta</option>
            <option v-for="fair in fairsStore.fairs" :key="fair.id" :value="fair.id">{{ fair.name }}</option>
          </select>
          <button type="button" class="h-11 rounded-lg bg-sky-900 px-4 text-sm font-black text-white disabled:opacity-40" :disabled="!assignmentTargets[legacyKey(record)]" @click="associateLegacy(record)">
            Associar localmente
          </button>
        </div>
      </article>
    </section>

    <p v-if="issueMessage" class="mt-4 rounded-lg bg-red-50 p-3 text-sm font-bold text-red-700">{{ issueMessage }}</p>
    <p v-if="fairsStore.fairs.length === 0 && !fairsStore.loading" class="mt-8 text-center font-semibold text-slate-500">
      Crie sua primeira feira para começar.
    </p>
  </section>
</template>
