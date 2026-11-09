'use client'

import { Button, useConfig } from '@payloadcms/ui'
import * as React from 'react'

import type { BulkLinkSyncResponse } from '../../server/linkSyncTypes.js'
import type {
  LocaleSyncStatus,
  SyncStatusDocument,
  SyncStatusScanEvent,
} from '../../server/syncStatusTypes.js'
import type { BulkStreamEvent } from '../../server/translationTypes.js'

import { postBulkStream } from '../shared/streamBulkEvents.js'
import {
  Badge,
  CheckboxCardGroup,
  LogViewer,
  ProgressSection,
  StatGrid,
  ToolPage,
  ToolPanel,
  ToolSection,
  useToolLogs,
} from '../shared/ToolUI.js'
import toolStyles from '../shared/ToolUI.module.css'
import { runBulkSyncLinks } from '../sync-links/utils/runBulkSyncLinks.js'
import styles from './TranslationStatusGlobal.module.css'
import { runSyncStatusScan } from './utils/runSyncStatusScan.js'

type CollectionOption = {
  /**
   * Top-level translatable field roots of this collection; offered as
   * skip-field checkboxes once documents of this collection are selected.
   */
  fields?: string[]
  label: string
  slug: string
}

type TargetOption = {
  /**
   * Top-level translatable field roots of this global; offered as
   * skip-field checkboxes once the global is selected.
   */
  fields?: string[]
  label: string
  slug: string
}

type TranslationStatusGlobalProps = {
  collections: CollectionOption[]
  defaultLocale: string
  globals?: TargetOption[]
  locales: string[]
}

type StatusFilter = 'all' | 'needs-sync' | 'synced'

function documentNeedsSync(document: SyncStatusDocument): boolean {
  return document.locales.some((locale) => locale.status !== 'synced')
}

function documentKey(document: SyncStatusDocument): string {
  return document.global
    ? `global:${document.global}`
    : `${document.collection}:${String(document.id)}`
}

function documentIsSelectable(document: SyncStatusDocument): boolean {
  return Boolean(document.global) || (Boolean(document.collection) && document.id != null)
}

function formatTarget(collection: string, id: string): string {
  if (collection.startsWith('global:') && collection.slice('global:'.length) === id) {
    return collection
  }

  return `${collection}#${id}`
}

function localeBadgeTone(status: LocaleSyncStatus['status']): 'error' | 'success' | 'warning' {
  if (status === 'synced') {
    return 'success'
  }
  if (status === 'never-synced') {
    return 'error'
  }
  return 'warning'
}

function localeBadgeText(locale: LocaleSyncStatus): string {
  if (locale.status === 'synced') {
    return `${locale.locale} ✓`
  }
  if (locale.status === 'never-synced') {
    return `${locale.locale} · never synced`
  }
  if (locale.missingFields) {
    return `${locale.locale} · ${locale.changedFields} need sync (${locale.missingFields} missing)`
  }
  return `${locale.locale} · ${locale.changedFields} changed`
}

function formatSyncedAt(value?: string): string {
  if (!value) {
    return 'never'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return 'never'
  }

  return date.toLocaleString()
}

function parseExtraSkipFields(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/[,\n;]/)
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  )
}

export function TranslationStatusGlobal({
  collections,
  defaultLocale,
  globals = [],
  locales,
}: TranslationStatusGlobalProps) {
  const {
    config: { routes },
  } = useConfig()

  const allTargets = React.useMemo(
    () => [
      ...collections.map((entry) => ({
        slug: entry.slug,
        type: 'collection' as const,
        key: `collection:${entry.slug}`,
        label: entry.label,
      })),
      ...globals.map((entry) => ({
        slug: entry.slug,
        type: 'global' as const,
        key: `global:${entry.slug}`,
        label: entry.label,
      })),
    ],
    [collections, globals],
  )

  const fieldsByCollection = React.useMemo(
    () => new Map(collections.map((entry) => [entry.slug, entry.fields ?? []])),
    [collections],
  )

  const fieldsByGlobal = React.useMemo(
    () => new Map(globals.map((entry) => [entry.slug, entry.fields ?? []])),
    [globals],
  )

  const [selectedKeys, setSelectedKeys] = React.useState<string[]>(() =>
    allTargets.map((entry) => entry.key),
  )
  const [scanning, setScanning] = React.useState(false)
  const [syncing, setSyncing] = React.useState(false)
  const [linkSyncing, setLinkSyncing] = React.useState(false)
  const [hasScanned, setHasScanned] = React.useState(false)
  const [documents, setDocuments] = React.useState<SyncStatusDocument[]>([])
  const [progress, setProgress] = React.useState({ completed: 0, total: 0 })
  const [currentTask, setCurrentTask] = React.useState('Waiting to start…')
  const [filter, setFilter] = React.useState<StatusFilter>('needs-sync')
  const [search, setSearch] = React.useState('')
  const [selectedDocKeys, setSelectedDocKeys] = React.useState<string[]>([])
  const [overwrite, setOverwrite] = React.useState(false)
  const [skipFieldKeys, setSkipFieldKeys] = React.useState<string[]>([])
  const [extraSkipText, setExtraSkipText] = React.useState('')
  const log = useToolLogs()

  React.useEffect(() => {
    setSelectedKeys((previous) => {
      const allowed = new Set(allTargets.map((entry) => entry.key))
      const filtered = previous.filter((key) => allowed.has(key))
      return filtered.length ? filtered : allTargets.map((entry) => entry.key)
    })
  }, [allTargets])

  const busy = scanning || syncing || linkSyncing
  const targetLocales = React.useMemo(
    () => locales.filter((code) => code !== defaultLocale),
    [defaultLocale, locales],
  )

  const documentByKey = React.useMemo(() => {
    const map = new Map<string, SyncStatusDocument>()
    for (const document of documents) {
      map.set(documentKey(document), document)
    }
    return map
  }, [documents])

  const selectedDocuments = React.useMemo(
    () =>
      selectedDocKeys
        .map((key) => documentByKey.get(key))
        .filter((document): document is SyncStatusDocument => Boolean(document))
        .filter(documentIsSelectable),
    [documentByKey, selectedDocKeys],
  )

  const selectedCollectionDocuments = React.useMemo(
    () =>
      selectedDocuments.filter((document) => Boolean(document.collection) && document.id != null),
    [selectedDocuments],
  )

  const selectedGlobalSlugs = React.useMemo(
    () =>
      Array.from(
        new Set(
          selectedDocuments
            .map((document) => document.global)
            .filter((slug): slug is string => Boolean(slug)),
        ),
      ),
    [selectedDocuments],
  )

  /**
   * Skip-field options follow the selection: the union of translatable field
   * roots of the collections and globals the selected documents belong to.
   */
  const availableSkipFields = React.useMemo(() => {
    const fields = new Set<string>()
    for (const document of selectedDocuments) {
      const roots = document.global
        ? fieldsByGlobal.get(document.global)
        : document.collection
          ? fieldsByCollection.get(document.collection)
          : undefined
      for (const field of roots ?? []) {
        fields.add(field)
      }
    }
    return Array.from(fields).sort()
  }, [fieldsByCollection, fieldsByGlobal, selectedDocuments])

  const skipFields = React.useMemo(
    () =>
      Array.from(
        new Set([
          ...parseExtraSkipFields(extraSkipText),
          ...skipFieldKeys.filter((field) => availableSkipFields.includes(field)),
        ]),
      ),
    [availableSkipFields, extraSkipText, skipFieldKeys],
  )

  const toggleTarget = (key: string) =>
    setSelectedKeys((previous) =>
      previous.includes(key) ? previous.filter((entry) => entry !== key) : [...previous, key],
    )

  const toggleAllTargets = () =>
    setSelectedKeys((previous) =>
      previous.length === allTargets.length ? [] : allTargets.map((entry) => entry.key),
    )

  const toggleSkipField = (field: string) =>
    setSkipFieldKeys((previous) =>
      previous.includes(field) ? previous.filter((entry) => entry !== field) : [...previous, field],
    )

  const handleScanEvent = (event: SyncStatusScanEvent) => {
    switch (event.type) {
      case 'collection-error':
        log.addLog(`${event.collection}: ${event.message}`, 'error')
        break
      case 'collection-start':
        setCurrentTask(`Scanning ${event.label} (${event.totalDocuments} document(s))…`)
        break
      case 'document-result':
        setDocuments((previous) => [...previous, event.document])
        setProgress((previous) => ({
          completed: Math.min(previous.total, previous.completed + 1),
          total: previous.total,
        }))
        break
      case 'error':
        log.addLog(event.message || 'Sync status scan failed.', 'error')
        setCurrentTask('Scan failed.')
        setScanning(false)
        break
      case 'scan-complete':
        log.addLog(
          `Scan finished: ${event.outOfSync} of ${event.processed} document(s) need a sync.`,
          event.outOfSync ? 'skip' : 'success',
        )
        setProgress((previous) => ({ completed: event.processed, total: previous.total }))
        setCurrentTask('Scan complete.')
        setScanning(false)
        break
      case 'scan-start':
        setProgress({ completed: 0, total: event.totalDocuments })
        log.addLog(
          `Scanning ${event.totalCollections} target(s) / ${event.totalDocuments} document(s).`,
        )
        break
    }
  }

  const startScan = async () => {
    if (busy || !selectedKeys.length) {
      return
    }

    const scanTargets = {
      collections: allTargets
        .filter((entry) => entry.type === 'collection' && selectedKeys.includes(entry.key))
        .map((entry) => entry.slug),
      globals: allTargets
        .filter((entry) => entry.type === 'global' && selectedKeys.includes(entry.key))
        .map((entry) => entry.slug),
    }

    if (!scanTargets.collections.length && !scanTargets.globals.length) {
      return
    }

    setScanning(true)
    setHasScanned(true)
    setDocuments([])
    setSelectedDocKeys([])
    setProgress({ completed: 0, total: 0 })
    setCurrentTask('Preparing scan…')

    try {
      await runSyncStatusScan(scanTargets, handleScanEvent)
    } catch (error) {
      log.addLog(error instanceof Error ? error.message : 'Sync status scan failed.', 'error')
      setCurrentTask('Scan failed.')
      setScanning(false)
    }
  }

  const handleBulkEvent = (event: BulkStreamEvent) => {
    switch (event.type) {
      case 'bulk-complete':
        log.addLog(
          `Translation finished. Processed ${event.processed}, skipped ${event.skipped}, failed ${event.failed}.`,
          event.failed ? 'error' : 'success',
        )
        setCurrentTask('Translation complete — refreshing overview…')
        setSyncing(false)
        // Refresh the overview so the new sync state is visible right away.
        void startScan()
        break
      case 'bulk-start':
        setProgress({ completed: 0, total: event.totalDocuments })
        log.addLog(`Translating ${event.totalDocuments} document(s).`)
        setCurrentTask('Preparing translation…')
        break
      case 'collection-complete':
        log.addLog(
          `Finished ${event.collection}: ${event.processed} processed, ${event.skipped} skipped, ${event.failed} failed.`,
        )
        break
      case 'collection-start':
        setCurrentTask(`Processing ${event.collection}…`)
        break
      case 'document-applied':
        log.addLog(
          `Saved translations for ${formatTarget(event.collection, event.id)} (${event.locale}).`,
          'success',
        )
        break
      case 'document-error':
        log.addLog(`Failed ${formatTarget(event.collection, event.id)}: ${event.message}.`, 'error')
        setProgress((previous) => ({
          completed: Math.min(previous.total, previous.completed + 1),
          total: previous.total,
        }))
        break
      case 'document-progress':
        setCurrentTask(
          `Translating ${formatTarget(event.collection, event.id)} (${event.locale}) ${event.completed}/${event.total}.`,
        )
        break
      case 'document-skipped':
        log.addLog(
          `Skipped ${formatTarget(event.collection, event.id)}: ${event.reason || 'No action required.'}`,
          'skip',
        )
        setProgress((previous) => ({
          completed: Math.min(previous.total, previous.completed + 1),
          total: previous.total,
        }))
        break
      case 'document-start':
        setCurrentTask(`Translating ${formatTarget(event.collection, event.id)}…`)
        break
      case 'document-success':
        log.addLog(`Completed ${formatTarget(event.collection, event.id)}.`, 'success')
        setProgress((previous) => ({
          completed: Math.min(previous.total, previous.completed + 1),
          total: previous.total,
        }))
        break
      case 'error':
        log.addLog(event.message || 'Translation failed.', 'error')
        setCurrentTask('Translation failed.')
        setSyncing(false)
        break
      default:
        break
    }
  }

  const groupSelectedByCollection = (): Map<string, Array<number | string>> => {
    const grouped = new Map<string, Array<number | string>>()
    for (const document of selectedCollectionDocuments) {
      if (!document.collection || document.id == null) {
        continue
      }
      if (!grouped.has(document.collection)) {
        grouped.set(document.collection, [])
      }
      grouped.get(document.collection)?.push(document.id)
    }
    return grouped
  }

  const startTranslate = async () => {
    if (busy || !targetLocales.length || !selectedDocuments.length) {
      return
    }

    const grouped = groupSelectedByCollection()
    const ok = window.confirm(
      [
        `Translate ${selectedDocuments.length} selected document(s)?`,
        `Translating ${defaultLocale} → ${targetLocales.join(', ')}`,
        overwrite ? 'Overwrite existing translations: yes' : '',
        skipFields.length ? `Skip fields: ${skipFields.join(', ')}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    )
    if (!ok) {
      return
    }

    setSyncing(true)
    setProgress({ completed: 0, total: 0 })
    setCurrentTask('Starting translation…')
    if (overwrite) {
      log.addLog('Overwrite enabled: existing translations will be replaced.')
    }
    if (skipFields.length) {
      log.addLog(`Skipping fields: ${skipFields.join(', ')}.`)
    }

    try {
      await postBulkStream(
        '/api/ai-translate/bulk',
        {
          collections: Array.from(grouped.keys()),
          documents: Object.fromEntries(grouped.entries()),
          globals: selectedGlobalSlugs,
          overwrite,
          skipFields,
        },
        handleBulkEvent,
        'Bulk translation request failed.',
      )
    } catch (error) {
      log.addLog(error instanceof Error ? error.message : 'Translation failed.', 'error')
      setCurrentTask('Translation failed.')
      setSyncing(false)
    }
  }

  const logLinkSyncResult = (result: BulkLinkSyncResponse) => {
    const { summary } = result
    log.addLog(
      `Link sync finished: ${summary.documentsUpdated} of ${summary.documentsProcessed} document(s) updated, ${summary.replacements} link(s) rewritten.`,
      summary.errors.length ? 'error' : 'success',
    )

    for (const detail of result.details) {
      if (detail.updatedLocales.length) {
        log.addLog(
          `Links updated for ${detail.collection ?? detail.global}#${detail.label} (${detail.updatedLocales.join(', ')}).`,
          'success',
        )
      }
    }

    for (const warning of summary.warnings.slice(0, 10)) {
      log.addLog(warning, 'skip')
    }
    for (const message of summary.errors.slice(0, 10)) {
      log.addLog(message, 'error')
    }
    for (const missing of summary.missingAlternates) {
      log.addLog(
        `No alternate links found for ${missing.locale} (${missing.count} document(s)).`,
        'skip',
      )
    }
  }

  const startLinkSync = async () => {
    if (busy || !selectedDocuments.length) {
      return
    }

    const grouped = groupSelectedByCollection()
    if (!window.confirm(`Sync links for ${selectedDocuments.length} selected document(s)?`)) {
      return
    }

    setLinkSyncing(true)
    setCurrentTask('Syncing links…')

    try {
      const result = await runBulkSyncLinks(Array.from(grouped.keys()), {
        documents: Object.fromEntries(grouped.entries()),
        globals: selectedGlobalSlugs,
      })
      logLinkSyncResult(result)
      setCurrentTask('Link sync complete.')
    } catch (error) {
      log.addLog(error instanceof Error ? error.message : 'Bulk link sync failed.', 'error')
      setCurrentTask('Link sync failed.')
    } finally {
      setLinkSyncing(false)
    }
  }

  const stats = React.useMemo(() => {
    const needsSync = documents.filter(documentNeedsSync)
    const neverSynced = documents.filter((document) =>
      document.locales.some((locale) => locale.status === 'never-synced'),
    )
    return {
      needsSync: needsSync.length,
      neverSynced: neverSynced.length,
      synced: documents.length - needsSync.length,
      total: documents.length,
    }
  }, [documents])

  const visibleDocuments = React.useMemo(() => {
    const query = search.trim().toLocaleLowerCase()

    return documents
      .filter((document) => {
        if (filter === 'needs-sync') {
          return documentNeedsSync(document)
        }
        if (filter === 'synced') {
          return !documentNeedsSync(document)
        }
        return true
      })
      .filter(
        (document) =>
          !query ||
          document.label.toLocaleLowerCase().includes(query) ||
          (document.collection ?? document.global ?? '').toLocaleLowerCase().includes(query),
      )
      .sort((left, right) => {
        const needsLeft = documentNeedsSync(left) ? 1 : 0
        const needsRight = documentNeedsSync(right) ? 1 : 0
        return (
          needsRight - needsLeft ||
          right.maxChangedFields - left.maxChangedFields ||
          left.label.localeCompare(right.label)
        )
      })
  }, [documents, filter, search])

  const selectableVisible = React.useMemo(
    () => visibleDocuments.filter(documentIsSelectable),
    [visibleDocuments],
  )

  const allVisibleSelected =
    selectableVisible.length > 0 &&
    selectableVisible.every((document) => selectedDocKeys.includes(documentKey(document)))

  const toggleDocument = (key: string) =>
    setSelectedDocKeys((previous) =>
      previous.includes(key) ? previous.filter((entry) => entry !== key) : [...previous, key],
    )

  const toggleAllVisible = () =>
    setSelectedDocKeys(
      allVisibleSelected ? [] : selectableVisible.map((document) => documentKey(document)),
    )

  const statusFilters: Array<{ label: string; value: StatusFilter }> = [
    { label: `Needs sync (${stats.needsSync})`, value: 'needs-sync' },
    { label: `Up to date (${stats.synced})`, value: 'synced' },
    { label: `All (${stats.total})`, value: 'all' },
  ]

  return (
    <ToolPage running={busy}>
      <ToolPanel
        description="Scan for source changes and missing saved translations. Published documents are checked against their published translations, without language fallback. Select documents below to translate them or sync their internal links."
        eyebrow="AI translations"
        headerExtra={
          <div className={toolStyles.badgeRow}>
            <Badge>Source: {defaultLocale}</Badge>
            {targetLocales.map((code) => (
              <Badge key={code}>→ {code}</Badge>
            ))}
          </div>
        }
        title="Translation status"
      >
        <CheckboxCardGroup
          disabled={busy}
          label="Targets"
          onToggle={toggleTarget}
          onToggleAll={toggleAllTargets}
          options={allTargets.map((target) => ({
            key: target.key,
            meta: `${target.type}:${target.slug}`,
            title: target.label,
          }))}
          selectedKeys={selectedKeys}
        />

        <div className={toolStyles.actions}>
          <Button
            disabled={busy || !selectedKeys.length}
            onClick={() => void startScan()}
            type="button"
          >
            {scanning ? 'Scanning…' : 'Scan translation status'}
          </Button>
        </div>
      </ToolPanel>

      {hasScanned ? (
        <ToolPanel>
          <ToolSection>
            <StatGrid
              stats={[
                { label: 'Documents scanned', value: stats.total },
                {
                  label: 'Needs sync',
                  tone: stats.needsSync ? 'warning' : 'success',
                  value: stats.needsSync,
                },
                {
                  label: 'Never synced',
                  tone: stats.neverSynced ? 'error' : 'default',
                  value: stats.neverSynced,
                },
                { label: 'Up to date', tone: 'success', value: stats.synced },
              ]}
            />
          </ToolSection>
          <ToolSection>
            <ProgressSection
              completed={progress.completed}
              status={currentTask}
              total={progress.total}
            />
          </ToolSection>
        </ToolPanel>
      ) : null}

      <ToolPanel title="Documents">
        <div className={styles.toolbar}>
          <input
            aria-label="Search documents"
            className={`${toolStyles.input} ${styles.search}`}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search document or collection…"
            type="search"
            value={search}
          />
          <div className={toolStyles.chipRow} role="group">
            {statusFilters.map((option) => (
              <button
                aria-pressed={filter === option.value}
                className={`${toolStyles.chip} ${filter === option.value ? toolStyles.chipActive : ''}`}
                key={option.value}
                onClick={() => setFilter(option.value)}
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {!documents.length ? (
          <p className={toolStyles.empty}>
            {hasScanned && !scanning
              ? 'No documents found for the selected targets.'
              : 'Run a scan to see which documents still need a translation sync.'}
          </p>
        ) : !visibleDocuments.length ? (
          <p className={toolStyles.empty}>No documents match the current filters.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.selectCell}>
                    <input
                      aria-label="Select all visible documents"
                      checked={allVisibleSelected}
                      disabled={busy || !selectableVisible.length}
                      onChange={toggleAllVisible}
                      type="checkbox"
                    />
                  </th>
                  <th>Document</th>
                  <th>Locales</th>
                  <th>Fields</th>
                  <th>Last synced</th>
                </tr>
              </thead>
              <tbody>
                {visibleDocuments.map((document) => {
                  const key = documentKey(document)
                  const selectable = documentIsSelectable(document)
                  const href = document.global
                    ? `${routes.admin}/globals/${encodeURIComponent(document.global)}`
                    : `${routes.admin}/collections/${encodeURIComponent(
                        document.collection ?? '',
                      )}/${encodeURIComponent(String(document.id))}`
                  const latestSync = document.locales
                    .map((locale) => locale.syncedAt)
                    .filter((value): value is string => Boolean(value))
                    .sort()
                    .at(-1)

                  return (
                    <tr key={key}>
                      <td className={styles.selectCell}>
                        <input
                          aria-label={`Select ${document.label}`}
                          checked={selectedDocKeys.includes(key)}
                          disabled={busy || !selectable}
                          onChange={() => toggleDocument(key)}
                          type="checkbox"
                        />
                      </td>
                      <td>
                        <a className={styles.documentLink} href={href}>
                          {document.label}
                        </a>
                        <div className={styles.documentMeta}>
                          {document.global
                            ? `global:${document.global}`
                            : `${document.collection} · ${String(document.id)}`}
                        </div>
                      </td>
                      <td>
                        <span className={styles.localeBadges}>
                          {document.locales.map((locale) => (
                            <span
                              key={locale.locale}
                              title={`Last synced: ${formatSyncedAt(locale.syncedAt)}`}
                            >
                              <Badge tone={localeBadgeTone(locale.status)}>
                                {localeBadgeText(locale)}
                              </Badge>
                            </span>
                          ))}
                        </span>
                      </td>
                      <td className={styles.fieldCount}>
                        {document.maxChangedFields ? (
                          <>
                            {document.maxChangedFields}/{document.totalFields} need sync
                          </>
                        ) : (
                          <span className={styles.muted}>{document.totalFields} fields</span>
                        )}
                      </td>
                      <td>
                        <span className={styles.muted}>{formatSyncedAt(latestSync)}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {selectedDocuments.length ? (
          <div className={styles.selectionBar}>
            <div className={styles.selectionHeader}>
              <span className={styles.selectionCount}>
                {selectedDocuments.length} document{selectedDocuments.length === 1 ? '' : 's'}{' '}
                selected
              </span>
              <button
                className={toolStyles.chip}
                disabled={busy}
                onClick={() => setSelectedDocKeys([])}
                type="button"
              >
                Clear selection
              </button>
            </div>

            {availableSkipFields.length ? (
              <div className={toolStyles.field}>
                <span className={toolStyles.fieldLabel}>Skip fields</span>
                <div className={toolStyles.chipRow} role="group">
                  {availableSkipFields.map((field) => (
                    <button
                      aria-pressed={skipFieldKeys.includes(field)}
                      className={`${toolStyles.chip} ${skipFieldKeys.includes(field) ? toolStyles.chipActive : ''}`}
                      disabled={busy}
                      key={field}
                      onClick={() => toggleSkipField(field)}
                      type="button"
                    >
                      {field}
                    </button>
                  ))}
                </div>
                <p className={toolStyles.fieldHint}>
                  Fields of the selected documents — checked fields are left untouched when
                  translating.
                </p>
              </div>
            ) : null}

            <div className={styles.selectionOptions}>
              <label className={toolStyles.checkboxRow}>
                <input
                  aria-label="Overwrite existing translations"
                  checked={overwrite}
                  disabled={busy}
                  onChange={(event) => setOverwrite(event.target.checked)}
                  type="checkbox"
                />
                Overwrite existing translations
              </label>

              <input
                aria-label="Additional field paths to skip"
                className={`${toolStyles.input} ${styles.extraSkipInput}`}
                disabled={busy}
                onChange={(event) => setExtraSkipText(event.target.value)}
                placeholder="Additional paths to skip, e.g. seo.title"
                type="text"
                value={extraSkipText}
              />
            </div>

            <div className={toolStyles.actions}>
              <Button
                disabled={busy || !targetLocales.length}
                onClick={() => void startTranslate()}
                type="button"
              >
                {syncing
                  ? 'Translating…'
                  : `Translate ${selectedDocuments.length} document${selectedDocuments.length === 1 ? '' : 's'}`}
              </Button>
              <Button
                buttonStyle="secondary"
                disabled={busy}
                onClick={() => void startLinkSync()}
                type="button"
              >
                {linkSyncing ? 'Syncing links…' : `Sync links (${selectedDocuments.length})`}
              </Button>
            </div>
          </div>
        ) : null}
      </ToolPanel>

      <LogViewer emptyText="Run a scan to see activity here." log={log} />
    </ToolPage>
  )
}
