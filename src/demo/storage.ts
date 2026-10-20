export const DEMO_STORAGE_NAMESPACE = 'festa-camarao-portfolio-demo'
export const DEMO_STORAGE_KEYS = {
  session: DEMO_STORAGE_NAMESPACE + ':session',
  selectedFairId: DEMO_STORAGE_NAMESPACE + ':selectedFairId',
} as const

export const readDemoSelectedFairId = () =>
  window.localStorage.getItem(DEMO_STORAGE_KEYS.selectedFairId)
export const writeDemoSelectedFairId = (fairId: string) =>
  window.localStorage.setItem(DEMO_STORAGE_KEYS.selectedFairId, fairId)
export const clearDemoSelectedFairId = () =>
  window.localStorage.removeItem(DEMO_STORAGE_KEYS.selectedFairId)
