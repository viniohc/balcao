import { initializeApp, type FirebaseApp } from 'firebase/app'
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type Auth,
  type User,
} from 'firebase/auth'
import { getFirestore, type Firestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const isFirebaseConfigured = Object.values(firebaseConfig).every(Boolean)

let app: FirebaseApp | undefined
let auth: Auth | undefined
let firestore: Firestore | undefined

export const getFirebaseApp = () => {
  if (!isFirebaseConfigured) {
    throw new Error('Firebase não configurado. Preencha o arquivo .env com as variáveis VITE_FIREBASE_*.')
  }

  app ??= initializeApp(firebaseConfig)
  return app
}

export const getFirebaseDb = () => {
  firestore ??= getFirestore(getFirebaseApp())
  return firestore
}

export const getFirebaseAuth = () => {
  auth ??= getAuth(getFirebaseApp())
  return auth
}

export const ensureFirebaseSignedIn = async () => {
  const firebaseAuth = getFirebaseAuth()

  if (firebaseAuth.currentUser) {
    return firebaseAuth.currentUser
  }

  const user = await waitForFirebaseUser()
  if (!user) {
    throw new Error('Faça login para acessar o Firestore.')
  }

  return user
}

export const waitForFirebaseUser = () =>
  new Promise<User | null>((resolve) => {
    const unsubscribe = onAuthStateChanged(getFirebaseAuth(), (user) => {
      unsubscribe()
      resolve(user)
    })
  })

export const loginWithEmail = (email: string, password: string) =>
  signInWithEmailAndPassword(getFirebaseAuth(), email, password)

export const createFirebaseAccount = (email: string, password: string) =>
  createUserWithEmailAndPassword(getFirebaseAuth(), email, password)

export const logoutFirebase = () => signOut(getFirebaseAuth())
