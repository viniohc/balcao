import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { createFirebaseAccount, getFirebaseAuth, loginWithEmail, logoutFirebase } from '@/lib/firebase'
import { onAuthStateChanged, type User } from 'firebase/auth'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(getFirebaseAuth().currentUser)
  const ready = ref(false)

  const isAuthenticated = computed(() => Boolean(user.value))

  const initAuth = () =>
    new Promise<void>((resolve) => {
      onAuthStateChanged(getFirebaseAuth(), (firebaseUser) => {
        user.value = firebaseUser
        ready.value = true
        resolve()
      })
    })

  const login = async (email: string, password: string) => {
    const credential = await loginWithEmail(email, password)
    user.value = credential.user
  }

  const createAccount = async (email: string, password: string) => {
    const credential = await createFirebaseAccount(email, password)
    user.value = credential.user
  }

  const logout = async () => {
    await logoutFirebase()
    user.value = null
  }

  return {
    user,
    ready,
    isAuthenticated,
    initAuth,
    login,
    createAccount,
    logout,
  }
})
