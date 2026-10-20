import { DEMO_STORAGE_KEYS } from '@/demo/storage'

export const DEMO_CREDENTIALS = Object.freeze({
  email: 'demo@feira.local',
  password: 'FeiraDemo2026!',
})
const DEMO_SESSION_VALUE = 'authenticated'

export const hasDemoSession = () =>
  window.localStorage.getItem(DEMO_STORAGE_KEYS.session) === DEMO_SESSION_VALUE

export const loginDemo = (email: string, password: string) => {
  if (email.trim().toLowerCase() !== DEMO_CREDENTIALS.email || password !== DEMO_CREDENTIALS.password) return false
  window.localStorage.setItem(DEMO_STORAGE_KEYS.session, DEMO_SESSION_VALUE)
  return true
}

export const logoutDemo = () =>
  window.localStorage.removeItem(DEMO_STORAGE_KEYS.session)
