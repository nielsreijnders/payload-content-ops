import type { CollectionConfig, Payload } from 'payload'

import { createHash } from 'node:crypto'

import type { TranslatableItem } from '../components/auto-translate-button/utils/buildTranslatableItems.js'
import type { LocaleSyncStatus, SyncFieldChange, SyncSnapshotEntry } from './syncStatusTypes.js'

import { extractPlainText, getValueAtPath } from '../utils/localizedFields.js'
import { logDebug } from './debugSettings.js'
import {
  collectConcreteLocalizedContainerPaths,
  pruneIdentifierFields,
} from './identifierPruning.js'

/**
 * Bookkeeping for translation syncs. Every successful sync of a locale stores
 * a fingerprint of the default-locale content (path + content hash per
 * translatable field). Comparing the current document against that snapshot
 * tells exactly which fields changed since the locale was last synced.
 */

export const SYNC_STATUS_COLLECTION_SLUG = 'ai-translation-sync'

export function buildTargetKey(target: {
  collection?: string
  documentId?: number | string
  global?: string
}): string {
  if (target.global) {
    return `global:${target.global}`
  }

  return `${target.collection}:${String(target.documentId)}`
}

/**
 * Hidden plugin collection storing one record per (target, locale).
 * Locked for API access — the plugin reads and writes with overrideAccess.
 */
export function createSyncStatusCollection(): CollectionConfig {
  return {
    slug: SYNC_STATUS_COLLECTION_SLUG,
    access: {
      create: () => false,
      delete: () => false,
      read: () => false,
      update: () => false,
    },
    admin: {
      hidden: true,
    },
    fields: [
      {
        // `${target}::${locale}`
        name: 'key',
        type: 'text',
        index: true,
        required: true,
        unique: true,
      },
      {
        // `${collection}:${id}` or `global:${slug}`
        name: 'target',
        type: 'text',
        index: true,
        required: true,
      },
      {
        name: 'locale',
        type: 'text',
        required: true,
      },
      {
        name: 'syncedAt',
        type: 'date',
        required: true,
      },
      {
        // SyncSnapshotEntry[]
        name: 'snapshot',
        type: 'json',
        required: true,
      },
    ],
    labels: {
      plural: 'AI Translation Sync Records',
      singular: 'AI Translation Sync Record',
    },
  }
}

export function hashSnapshotText(text: string): string {
  return createHash('sha1').update(text).digest('hex').slice(0, 20)
}

export function buildSyncSnapshot(items: TranslatableItem[]): SyncSnapshotEntry[] {
  return items.map((item) => ({
    hash: hashSnapshotText(item.text),
    lexical: item.lexical,
    path: item.path,
  }))
}

function snapshotEntryKey(entry: { lexical: boolean; path: string }): string {
  return `${entry.lexical ? '1' : '0'}:${entry.path}`
}

/**
 * Counts fields that differ between the current default-locale content and a
 * stored snapshot. Added and removed fields count as changes too — removed
 * content leaves stale text behind in the target locale.
 */
function changedSnapshotKeys(
  current: SyncSnapshotEntry[],
  stored: SyncSnapshotEntry[],
): Set<string> {
  const storedByKey = new Map(stored.map((entry) => [snapshotEntryKey(entry), entry.hash]))
  const seen = new Set<string>()
  const changes = new Set<string>()

  for (const entry of current) {
    const key = snapshotEntryKey(entry)
    seen.add(key)

    const previousHash = storedByKey.get(key)
    if (previousHash === undefined || previousHash !== entry.hash) {
      changes.add(key)
    }
  }

  for (const key of storedByKey.keys()) {
    if (!seen.has(key)) {
      changes.add(key)
    }
  }

  return changes
}

export function countSnapshotChanges(
  current: SyncSnapshotEntry[],
  stored: SyncSnapshotEntry[],
): number {
  return changedSnapshotKeys(current, stored).size
}

/** Check actual locale content, independently of the last source fingerprint. */
export function findMissingLocaleFields(
  source: Record<string, unknown>,
  translated: Record<string, unknown> | undefined,
  items: TranslatableItem[],
  localizedContainerPatterns: string[] = [],
): string[] {
  // Shared rows follow their ids when reordered. Localized arrays have their
  // own ids per locale, so compare those rows by position instead.
  const base = pruneIdentifierFields(source, {
    localizedContainers: collectConcreteLocalizedContainerPaths(source, localizedContainerPatterns),
  })
  return [
    ...new Set(
      items
        .filter((item) => !extractPlainText(getValueAtPath(translated, item.path, { base })))
        .map((item) => item.path),
    ),
  ]
}

function normalizeSnapshot(value: unknown): SyncSnapshotEntry[] {
  if (!Array.isArray(value)) {
    return []
  }

  const entries: SyncSnapshotEntry[] = []

  for (const raw of value) {
    if (typeof raw !== 'object' || raw === null) {
      continue
    }

    const candidate = raw as Record<string, unknown>
    if (typeof candidate.path !== 'string' || typeof candidate.hash !== 'string') {
      continue
    }

    entries.push({
      hash: candidate.hash,
      lexical: Boolean(candidate.lexical),
      path: candidate.path,
    })
  }

  return entries
}

export async function recordSyncSnapshot(
  payload: Payload,
  options: {
    locale: string
    snapshot: SyncSnapshotEntry[]
    target: string
  },
): Promise<void> {
  const key = `${options.target}::${options.locale}`

  try {
    const existing = await payload.find({
      collection: SYNC_STATUS_COLLECTION_SLUG,
      depth: 0,
      limit: 1,
      overrideAccess: true,
      pagination: false,
      where: { key: { equals: key } },
    })

    const current = existing.docs?.[0]
    const data = {
      key,
      locale: options.locale,
      snapshot: options.snapshot,
      syncedAt: new Date().toISOString(),
      target: options.target,
    }

    if (current && current.id != null) {
      await payload.update({
        id: current.id,
        collection: SYNC_STATUS_COLLECTION_SLUG,
        data,
        overrideAccess: true,
      })
    } else {
      await payload.create({
        collection: SYNC_STATUS_COLLECTION_SLUG,
        data,
        overrideAccess: true,
      })
    }
  } catch (error) {
    // Bookkeeping must never break the translation flow itself.
    const message = error instanceof Error ? error.message : 'Unknown error'
    payload.logger?.warn?.(`[AI Translate] Failed to record sync snapshot for ${key}: ${message}`)
    logDebug(payload, '[AI Translate] Failed to record sync snapshot.', {
      error: message,
      key,
    })
  }
}

export type StoredSyncRecord = {
  locale: string
  snapshot: SyncSnapshotEntry[]
  syncedAt?: string
}

/**
 * Loads all sync records for a batch of targets in one query, grouped by
 * target key.
 */
export async function fetchSyncRecords(
  payload: Payload,
  targets: string[],
): Promise<Map<string, StoredSyncRecord[]>> {
  const grouped = new Map<string, StoredSyncRecord[]>()

  if (!targets.length) {
    return grouped
  }

  const result = await payload.find({
    collection: SYNC_STATUS_COLLECTION_SLUG,
    depth: 0,
    overrideAccess: true,
    pagination: false,
    where: { target: { in: targets } },
  })

  for (const doc of result.docs ?? []) {
    const record = doc as unknown as {
      locale?: unknown
      snapshot?: unknown
      syncedAt?: unknown
      target?: unknown
    }

    if (typeof record.target !== 'string' || typeof record.locale !== 'string') {
      continue
    }

    if (!grouped.has(record.target)) {
      grouped.set(record.target, [])
    }

    grouped.get(record.target)?.push({
      locale: record.locale,
      snapshot: normalizeSnapshot(record.snapshot),
      syncedAt: typeof record.syncedAt === 'string' ? record.syncedAt : undefined,
    })
  }

  return grouped
}

/**
 * Derives the per-locale sync status of a document from its current snapshot
 * and actual target-locale completeness. Documents without translatable content report as
 * synced — there is nothing to translate.
 */
export function computeLocaleStatuses(
  current: SyncSnapshotEntry[],
  records: StoredSyncRecord[],
  locales: string[],
  missingByLocale: ReadonlyMap<string, string[]> = new Map(),
): LocaleSyncStatus[] {
  return locales.map((locale) => {
    const record = records.find((entry) => entry.locale === locale)
    const missingPaths = new Set(missingByLocale.get(locale) ?? [])
    const missing = current.filter((entry) => missingPaths.has(entry.path))
    const missingFields = new Set(missing.map(snapshotEntryKey)).size
    const completeness = missingFields ? { missingFields } : {}

    if (!record) {
      return current.length
        ? {
            changedFields: current.length,
            ...completeness,
            locale,
            status: 'never-synced' as const,
          }
        : { changedFields: 0, locale, status: 'synced' as const }
    }

    const affected = changedSnapshotKeys(current, record.snapshot)
    for (const entry of missing) {
      affected.add(snapshotEntryKey(entry))
    }
    const changedFields = affected.size
    const currentByKey = new Map(current.map((entry) => [snapshotEntryKey(entry), entry]))
    const storedByKey = new Map(record.snapshot.map((entry) => [snapshotEntryKey(entry), entry]))
    const fieldChanges: SyncFieldChange[] = [...affected].map((key) => {
      const now = currentByKey.get(key)
      const before = storedByKey.get(key)
      const entry = now ?? before!
      return {
        ...(now ? { currentHash: now.hash } : {}),
        lexical: entry.lexical,
        ...(now && missingPaths.has(now.path) ? { missingTranslation: true } : {}),
        path: entry.path,
        ...(before ? { previousHash: before.hash } : {}),
        reason: !now
          ? 'removed'
          : !before
            ? 'added'
            : now.hash !== before.hash
              ? 'changed'
              : 'missing',
      }
    })

    return {
      changedFields,
      ...(fieldChanges.length ? { fieldChanges } : {}),
      ...completeness,
      locale,
      status: changedFields ? ('out-of-sync' as const) : ('synced' as const),
      syncedAt: record.syncedAt,
    }
  })
}
