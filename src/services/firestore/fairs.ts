import { byField, getCollection, getDocument, patchDocument, setDocument } from '@/services/firestore/base'
import type { Fair } from '@/types/models'

const COLLECTION = 'fairs'

export const listCloudFairs = async (userId: string) => {
  const fairs = await getCollection<Fair>(COLLECTION, 50, [byField(`members.${userId}`, '==', true)])
  return fairs.filter((fair) => fair.active).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export const getCloudFair = (fairId: string) => getDocument<Fair>(COLLECTION, fairId)

export const saveCloudFair = (fair: Fair) => setDocument(COLLECTION, fair)

export const updateCloudFair = (fairId: string, fair: Partial<Fair>) =>
  patchDocument<Fair>(COLLECTION, fairId, {
    ...fair,
    updatedAt: new Date().toISOString(),
  })
