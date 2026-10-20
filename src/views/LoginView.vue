<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()
const email = ref('')
const password = ref('')
const showPassword = ref(false)
const errorMessage = ref('')
const loading = ref(false)
const canSubmit = computed(() => email.value.includes('@') && password.value.length >= 6 && !loading.value)

const submit = async () => {
  errorMessage.value = ''
  loading.value = true

  try {
    await authStore.login(email.value.trim(), password.value)
    router.push('/fairs')
  } catch {
    errorMessage.value = 'Email ou senha inválidos, ou o provedor Email/Senha ainda não foi habilitado.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <section class="mx-auto grid min-h-dvh max-w-md place-items-center px-4 py-10">
    <form class="w-full rounded-xl border border-slate-200 bg-white p-5 shadow-lg" @submit.prevent="submit">
      <h1 class="text-2xl font-black">Caixa da Feira</h1>
      <p class="mt-1 text-sm font-semibold text-slate-500">Entre para acessar suas festas e feiras.</p>

      <label class="mt-5 block">
        <span class="text-sm font-bold text-slate-600">Email</span>
        <input v-model.trim="email" type="email" autocomplete="email" class="mt-1 h-12 w-full rounded-lg border border-slate-300 px-3 font-semibold outline-none focus:border-slate-950">
      </label>

      <label class="mt-3 block">
        <span class="text-sm font-bold text-slate-600">Senha</span>
        <span class="mt-1 flex h-12 items-center rounded-lg border border-slate-300 bg-white focus-within:border-slate-950">
          <input
            v-model="password"
            :type="showPassword ? 'text' : 'password'"
            autocomplete="current-password"
            class="h-full min-w-0 flex-1 rounded-lg px-3 font-semibold outline-none"
          >
          <button
            type="button"
            class="h-full px-3 text-sm font-black text-slate-600"
            :aria-label="showPassword ? 'Ocultar senha' : 'Mostrar senha'"
            @click="showPassword = !showPassword"
          >
            {{ showPassword ? 'Ocultar' : 'Mostrar' }}
          </button>
        </span>
      </label>

      <p v-if="errorMessage" class="mt-3 rounded-lg bg-red-50 p-3 text-sm font-bold text-red-700">{{ errorMessage }}</p>

      <button type="submit" class="mt-5 w-full rounded-lg bg-slate-950 py-4 font-black text-white disabled:bg-slate-300" :disabled="!canSubmit">
        {{ loading ? 'Entrando...' : 'Entrar' }}
      </button>
    </form>
  </section>
</template>
