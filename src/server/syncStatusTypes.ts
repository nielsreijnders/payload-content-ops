/**
 * A content fingerprint of one translatable field in the default locale,
 * captured at the moment a translation sync completed.
 */
export type SyncSnapshotEntry = {
  hash: string
  lexical: boolean
  path: string
}

export type SyncFieldChange = {
  currentHash?: string
  lexical: boolean
  missingTranslation?: boolean
  path: string
  previousHash?: string
  reason: 'added' | 'changed' | 'missing' | 'removed'
}

export type LocaleSyncStatus = {
  /**
   * Number of translatable fields that changed (or were added/removed) in the
   * default locale since this locale was last synced, or are missing from the
   * saved target locale. Each affected field is counted once.
   */
  changedFields: number
  /** Exact saved fields behind the count; hashes refer to the source locale. */
  fieldChanges?: SyncFieldChange[]
  locale: string
  /** Number of source fields whose saved translation is empty or absent. */
  missingFields?: number
  status: 'never-synced' | 'out-of-sync' | 'synced'
  syncedAt?: string
}

export type SyncStatusDocument = {
  collection?: string
  global?: string
  id?: number | string
  label: string
  locales: LocaleSyncStatus[]
  /**
   * Highest changedFields across all locales; used for ranking.
   */
  maxChangedFields: number
  totalFields: number
  updatedAt?: string
}

export type SyncStatusScanRequest = {
  collections: string[]
  globals: string[]
}

export type SyncStatusScanEvent =
  | { collection: string; label: string; totalDocuments: number; type: 'collection-start' }
  | { collection: string; message: string; type: 'collection-error' }
  | { document: SyncStatusDocument; type: 'document-result' }
  | { message: string; type: 'error' }
  | { outOfSync: number; processed: number; type: 'scan-complete' }
  | { totalCollections: number; totalDocuments: number; type: 'scan-start' }
