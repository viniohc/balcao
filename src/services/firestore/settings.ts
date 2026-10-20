import { getDocument, setDocument } from '@/services/firestore/base'
import type { Settings } from '@/types/models'

const collectionPath = (fairId: string) => `fairs/${fairId}/settings`
const DEFAULT_ID = 'default'

export const getCloudSettings = (fairId: string) => getDocument<Settings>(collectionPath(fairId), DEFAULT_ID)

export const saveCloudSettings = (settings: Settings) => setDocument(collectionPath(settings.fairId), settings)
