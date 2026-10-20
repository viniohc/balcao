import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
  type QueryConstraint,
  type Firestore,
  type WithFieldValue,
} from 'firebase/firestore'
import { ensureFirebaseSignedIn, getFirebaseDb } from '@/lib/firebase'

export const FIRESTORE_LIMITS = {
  products: 100,
  salesPerDay: 300,
  salesPerFair: 2000,
  settings: 1,
} as const

const withId = <T>(snapshot: { id: string; data: () => DocumentData }) => ({
  id: snapshot.id,
  ...snapshot.data(),
}) as T

const removeUndefinedFields = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(removeUndefinedFields)
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, fieldValue]) => fieldValue !== undefined)
        .map(([key, fieldValue]) => [key, removeUndefinedFields(fieldValue)]),
    )
  }

  return value
}

export const getCollection = async <T>(
  collectionPath: string,
  max = 50,
  constraints: QueryConstraint[] = [],
  firestoreOverride?: Firestore,
) => {
  if (!firestoreOverride) await ensureFirebaseSignedIn()
  const collectionRef = collection(firestoreOverride ?? getFirebaseDb(), collectionPath)
  const snapshot = await getDocs(query(collectionRef, ...constraints, limit(max)))
  return snapshot.docs.map((item) => withId<T>(item))
}

export const getDocument = async <T>(collectionPath: string, documentId: string) => {
  await ensureFirebaseSignedIn()
  const snapshot = await getDoc(doc(getFirebaseDb(), collectionPath, documentId))
  return snapshot.exists() ? withId<T>(snapshot) : undefined
}

export const setDocument = async <T extends { id: string }>(collectionPath: string, data: T) => {
  await ensureFirebaseSignedIn()
  await setDoc(
    doc(getFirebaseDb(), collectionPath, data.id),
    removeUndefinedFields(data) as WithFieldValue<DocumentData>,
  )
}

export const patchDocument = async <T extends object>(
  collectionPath: string,
  documentId: string,
  data: Partial<T>,
) => {
  await ensureFirebaseSignedIn()
  await updateDoc(doc(getFirebaseDb(), collectionPath, documentId), removeUndefinedFields(data) as DocumentData)
}

export const byField = where
export const orderedBy = orderBy
