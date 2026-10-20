import {
  collection,
  limit,
  onSnapshot,
  query,
  type DocumentData,
  type QueryDocumentSnapshot,
  type Unsubscribe,
  type Firestore,
} from 'firebase/firestore'
import { byField, FIRESTORE_LIMITS, getCollection, patchDocument, setDocument } from '@/services/firestore/base'
import { ensureFirebaseSignedIn, getFirebaseDb } from '@/lib/firebase'
import type { Product } from '@/types/models'

const collectionPath = (fairId: string) => `fairs/${fairId}/products`

const sortProducts = (products: Product[]) =>
  products.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))

export interface ListCloudProductsOptions {
  includeInactive?: boolean
  includeDeleted?: boolean
  firestore?: Firestore
}

export const listCloudProducts = async (fairId: string, options: ListCloudProductsOptions = {}) => {
  const { includeInactive = true, includeDeleted = false, firestore } = options
  const products = await getCollection<Product>(
    collectionPath(fairId),
    FIRESTORE_LIMITS.products,
    includeInactive ? [byField('fairId', '==', fairId)] : [byField('fairId', '==', fairId), byField('active', '==', true)],
    firestore,
  )

  const visibleProducts = includeDeleted ? products : products.filter((product) => !product.deleted)
  return sortProducts(visibleProducts)
}

export const saveCloudProduct = (product: Product) => setDocument(collectionPath(product.fairId), product)

export const updateCloudProduct = (productId: string, product: Partial<Product>) =>
  patchDocument<Product>(collectionPath(product.fairId ?? ''), productId, {
    ...product,
    updatedAt: new Date().toISOString(),
  })

const withId = <T>(snapshot: QueryDocumentSnapshot<DocumentData>) => ({
  id: snapshot.id,
  ...snapshot.data(),
}) as T

export const subscribeCloudProducts = async (
  fairId: string,
  onProducts: (products: Product[]) => void,
  onError?: (error: Error) => void,
): Promise<Unsubscribe> => {
  await ensureFirebaseSignedIn()

  return onSnapshot(
    query(collection(getFirebaseDb(), collectionPath(fairId)), byField('fairId', '==', fairId), limit(FIRESTORE_LIMITS.products)),
    (snapshot) => {
      const products = snapshot.docs.map((item) => withId<Product>(item))
      onProducts(sortProducts(products))
    },
    (error) => onError?.(error),
  )
}
