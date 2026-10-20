import { getCloudSettings } from '@/services/firestore/settings'

export const testFirestoreConnection = async (fairId: string) => {
  await getCloudSettings(fairId)
  return true
}
