import {
  collection,
  limit,
  onSnapshot,
  query,
  type DocumentData,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from 'firebase/firestore'
import { byField, FIRESTORE_LIMITS, getCollection, patchDocument, setDocument } from '@/services/firestore/base'
import { ensureFirebaseSignedIn, getFirebaseDb } from '@/lib/firebase'
import type { Sale } from '@/types/models'

const collectionPath = (fairId: string) => `fairs/${fairId}/sales`

export const listCloudSales = async (fairId: string, max = FIRESTORE_LIMITS.salesPerFair) => {
  const sales = await getCollection<Sale>(collectionPath(fairId), max, [byField('fairId', '==', fairId)])
  return sales.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export const listCloudSalesByDate = async (fairId: string, dateKey: string, max = FIRESTORE_LIMITS.salesPerDay) => {
  const sales = await getCollection<Sale>(collectionPath(fairId), max, [byField('fairId', '==', fairId), byField('dateKey', '==', dateKey)])
  return sales.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export const saveCloudSale = (sale: Sale) => setDocument(collectionPath(sale.fairId), sale)

export const updateCloudSale = (saleId: string, sale: Partial<Sale>) =>
  patchDocument<Sale>(collectionPath(sale.fairId ?? ''), saleId, sale)

export const cancelCloudSale = (fairId: string, saleId: string) =>
  patchDocument<Sale>(collectionPath(fairId), saleId, {
    status: 'cancelado',
    cancelledAt: new Date().toISOString(),
  })

const withId = <T>(snapshot: QueryDocumentSnapshot<DocumentData>) => ({
  id: snapshot.id,
  ...snapshot.data(),
}) as T

export const subscribeCloudSales = async (
  fairId: string,
  onSales: (sales: Sale[]) => void,
  onError?: (error: Error) => void,
): Promise<Unsubscribe> => {
  await ensureFirebaseSignedIn()

  return onSnapshot(
    query(collection(getFirebaseDb(), collectionPath(fairId)), byField('fairId', '==', fairId), limit(FIRESTORE_LIMITS.salesPerFair)),
    (snapshot) => {
      const sales = snapshot.docs.map((item) => withId<Sale>(item))
      onSales(sales.sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
    },
    (error) => onError?.(error),
  )
}
