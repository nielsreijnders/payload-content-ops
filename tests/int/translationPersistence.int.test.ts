/**
 * Integration tests against a REAL Payload + Postgres instance.
 *
 * Every incident this plugin has been involved in emerged from the
 * interaction with real core behavior (drizzle locale rows, version
 * snapshots, publishSpecificLocale, req.locale mutation) — the exact layer
 * mocked unit tests cannot see. This suite boots a disposable database and
 * regression-tests those failure classes end to end:
 *
 *  1. first-ever translation of a locale lands in that locale (misroute class)
 *  2. locale-scoped saves keep shared block rows + the other locale's values
 *     (the 2.1.1 id-strip wipe class)
 *  3. a hostile consumer hook that makes Payload mutate req.locale is
 *     detected by the post-save verification instead of corrupting silently
 *  4. never-published sources stay drafts (document-status class)
 *
 * Requires Postgres. Configure with INT_DATABASE_URI (a maintenance
 * database the suite may connect to; it creates/drops its own test
 * database). Defaults to postgres://postgres:postgres@127.0.0.1:5555/postgres
 * and the whole suite self-skips when no server is reachable.
 */
import type { CollectionBeforeChangeHook, Payload, SanitizedConfig } from 'payload'

import { postgresAdapter } from '@payloadcms/db-postgres'
import pg from 'pg'
import { buildConfig, createLocalReq, getPayload } from 'payload'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  TranslateRequestPayload,
  TranslateStreamEvent,
} from '../../src/server/translationTypes.js'

import { openAiTranslateTexts } from '../../src/server/openAiTranslationClient.js'
import { streamTranslations } from '../../src/server/translationStream.js'
import { configureTranslationState } from '../../src/server/translationStateStore.js'
import { createSyncStatusDocumentHandler } from '../../src/server/syncStatusHandler.js'
import {
  buildSyncSnapshot,
  createSyncStatusCollection,
  recordSyncSnapshot,
} from '../../src/server/syncStatusStore.js'

vi.mock('../../src/server/openAiTranslationClient.js', () => ({
  openAiTranslateTexts: vi.fn(),
}))

const translateTextsMock = vi.mocked(openAiTranslateTexts)

const MAINTENANCE_URI =
  process.env.INT_DATABASE_URI ?? 'postgres://postgres:postgres@127.0.0.1:5555/postgres'
const TEST_DB_NAME = 'payload_content_ops_int'

const testDatabaseUri = (() => {
  const url = new URL(MAINTENANCE_URI)
  url.pathname = `/${TEST_DB_NAME}`
  return url.toString()
})()

const postgresReachable = await (async () => {
  const client = new pg.Client({
    connectionString: MAINTENANCE_URI,
    connectionTimeoutMillis: 1500,
  })
  try {
    await client.connect()
    await client.end()
    return true
  } catch {
    await client.end().catch(() => {})
    return false
  }
})()

const describeInt = postgresReachable ? describe : describe.skip

// The hostile hook mirrors the real-world bug this suite guards against: a
// consumer beforeChange hook that passes `req` into a nested local operation
// with a different `locale`. Payload mutates `req.locale`, so the rest of
// the update keys localized values under the wrong locale.
const hostileHook: CollectionBeforeChangeHook = async ({ data, operation, originalDoc, req }) => {
  const id = (originalDoc as { id?: number | string } | undefined)?.id
  if (operation !== 'update' || !req.locale || req.locale === 'en' || id === undefined) {
    return data
  }

  await req.payload.findByID({
    id,
    collection: 'hostile',
    depth: 0,
    locale: 'en',
    overrideAccess: true,
    req,
  })

  return data
}

const collectionFields = [
  { name: 'title', type: 'text' as const, localized: true },
  {
    name: 'layout',
    type: 'blocks' as const,
    blocks: [
      {
        slug: 'hero',
        fields: [
          { name: 'heading', type: 'text' as const, localized: true },
          { name: 'label', type: 'text' as const },
        ],
      },
    ],
  },
]

const buildTestConfig = (): Promise<SanitizedConfig> =>
  buildConfig({
    collections: [
      createSyncStatusCollection(),
      {
        slug: 'posts',
        fields: collectionFields,
        versions: { drafts: { autosave: { interval: 600 } } },
      },
      {
        slug: 'hostile',
        fields: collectionFields,
        hooks: { beforeChange: [hostileHook] },
        versions: { drafts: { autosave: { interval: 600 } } },
      },
    ],
    db: postgresAdapter({ pool: { connectionString: testDatabaseUri }, push: true }),
    localization: { defaultLocale: 'en', fallback: false, locales: ['en', 'nl'] },
    secret: 'payload-content-ops-int-test',
    telemetry: false,
  })

let payload: Payload

const runStream = async (request: TranslateRequestPayload): Promise<TranslateStreamEvent[]> => {
  const events: TranslateStreamEvent[] = []
  for await (const event of streamTranslations(payload, request)) {
    events.push(event)
  }
  return events
}

const read = async (
  collection: 'hostile' | 'posts',
  id: number | string,
  locale: 'en' | 'nl',
  draft: boolean,
) => {
  const doc = (await payload.findByID({
    id,
    collection,
    depth: 0,
    draft,
    fallbackLocale: false,
    locale,
  })) as {
    _status?: string
    layout?: Array<{ heading?: null | string; id?: null | string; label?: null | string }>
    title?: null | string
  }
  return doc
}

const textChunk = (path: string, text: string) => ({ lexical: false, path, text })

describeInt('translation persistence (real Payload + Postgres)', () => {
  beforeAll(async () => {
    const admin = new pg.Client({ connectionString: MAINTENANCE_URI })
    await admin.connect()
    await admin.query(`DROP DATABASE IF EXISTS ${TEST_DB_NAME}`)
    await admin.query(`CREATE DATABASE ${TEST_DB_NAME}`)
    await admin.end()

    payload = await getPayload({ config: await buildTestConfig() })
  }, 120_000)

  afterAll(async () => {
    await payload?.destroy()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    configureTranslationState([], [], { defaultLocale: 'en', locales: ['en', 'nl'] })
    translateTextsMock.mockImplementation(async (texts) => texts.map((text) => `NL ${text}`))
  })

  it('lands a first-ever translation in the target locale and leaves the default locale untouched', async () => {
    const created = await payload.create({
      collection: 'posts',
      data: {
        _status: 'published',
        layout: [{ blockType: 'hero', heading: 'English heading', label: 'Shared label' }],
        title: 'English title',
      },
      locale: 'en',
    })

    const events = await runStream({
      id: created.id,
      collection: 'posts',
      from: 'en',
      locales: [
        {
          chunks: [
            [textChunk('title', 'English title'), textChunk('layout.0.heading', 'English heading')],
          ],
          code: 'nl',
        },
      ],
    })

    expect(events).not.toContainEqual(expect.objectContaining({ type: 'error' }))
    expect(events).toContainEqual({ locale: 'nl', type: 'applied' })

    const publishedNl = await read('posts', created.id, 'nl', false)
    expect(publishedNl.title).toBe('NL English title')
    expect(publishedNl.layout?.[0]?.heading).toBe('NL English heading')
    // Non-localized subfield rides along with the base value.
    expect(publishedNl.layout?.[0]?.label).toBe('Shared label')

    // The default locale must be byte-identical to before, in both layers.
    const publishedEn = await read('posts', created.id, 'en', false)
    expect(publishedEn.title).toBe('English title')
    expect(publishedEn.layout?.[0]?.heading).toBe('English heading')

    const draftEn = await read('posts', created.id, 'en', true)
    expect(draftEn.title).toBe('English title')
    expect(draftEn.layout?.[0]?.heading).toBe('English heading')
  })

  it('keeps shared block rows (ids and other-locale values) across a locale-scoped save', async () => {
    const created = await payload.create({
      collection: 'posts',
      data: {
        _status: 'published',
        layout: [
          { blockType: 'hero', heading: 'First heading', label: 'First label' },
          { blockType: 'hero', heading: 'Second heading', label: 'Second label' },
        ],
        title: 'Row keeper',
      },
      locale: 'en',
    })
    const originalRowIds = (created as { layout?: Array<{ id?: null | string }> }).layout?.map(
      (row) => row.id,
    )
    expect(originalRowIds).toHaveLength(2)

    const events = await runStream({
      id: created.id,
      collection: 'posts',
      from: 'en',
      locales: [
        {
          chunks: [
            [
              textChunk('layout.0.heading', 'First heading'),
              textChunk('layout.1.heading', 'Second heading'),
            ],
          ],
          code: 'nl',
        },
      ],
    })

    expect(events).toContainEqual({ locale: 'nl', type: 'applied' })

    // The en locale still has its own values on the same, un-recreated rows.
    const publishedEn = await read('posts', created.id, 'en', false)
    expect(publishedEn.layout?.map((row) => row.heading)).toEqual([
      'First heading',
      'Second heading',
    ])
    expect(publishedEn.layout?.map((row) => row.id)).toEqual(originalRowIds)

    const publishedNl = await read('posts', created.id, 'nl', false)
    expect(publishedNl.layout?.map((row) => row.heading)).toEqual([
      'NL First heading',
      'NL Second heading',
    ])
    expect(publishedNl.layout?.map((row) => row.id)).toEqual(originalRowIds)
  })

  it('detects a consumer hook that reroutes req.locale instead of corrupting silently', async () => {
    const created = await payload.create({
      collection: 'hostile',
      data: {
        _status: 'published',
        layout: [{ blockType: 'hero', heading: 'English heading', label: 'Shared label' }],
        title: 'English title',
      },
      locale: 'en',
    })

    const events = await runStream({
      id: created.id,
      collection: 'hostile',
      from: 'en',
      locales: [{ chunks: [[textChunk('title', 'English title')]], code: 'nl' }],
    })

    expect(events).toContainEqual(
      expect.objectContaining({
        message: expect.stringContaining('did not persist'),
        type: 'error',
      }),
    )
    expect(events).not.toContainEqual(expect.objectContaining({ type: 'applied' }))
  })

  it('keeps never-published sources as drafts', async () => {
    const created = await payload.create({
      collection: 'posts',
      data: { title: 'Draft only' },
      draft: true,
      locale: 'en',
    })

    const events = await runStream({
      id: created.id,
      collection: 'posts',
      from: 'en',
      locales: [{ chunks: [[textChunk('title', 'Draft only')]], code: 'nl' }],
    })

    expect(events).not.toContainEqual(expect.objectContaining({ type: 'error' }))
    expect(events).toContainEqual({ locale: 'nl', type: 'applied' })

    const draftNl = await read('posts', created.id, 'nl', true)
    expect(draftNl.title).toBe('NL Draft only')
    expect(draftNl._status).toBe('draft')

    const draftEn = await read('posts', created.id, 'en', true)
    expect(draftEn.title).toBe('Draft only')
    expect(draftEn._status).toBe('draft')
  })

  it('preserves pending draft edits in the default locale when publishing a translation', async () => {
    const created = await payload.create({
      collection: 'posts',
      data: { _status: 'published', title: 'Published title' },
      locale: 'en',
    })
    await payload.update({
      id: created.id,
      collection: 'posts',
      data: { title: 'Draft edit' },
      draft: true,
      locale: 'en',
    })

    const events = await runStream({
      id: created.id,
      collection: 'posts',
      from: 'en',
      locales: [{ chunks: [[textChunk('title', 'Published title')]], code: 'nl' }],
    })

    expect(events).not.toContainEqual(expect.objectContaining({ type: 'error' }))
    expect(events).toContainEqual({ locale: 'nl', type: 'applied' })

    const publishedNl = await read('posts', created.id, 'nl', false)
    expect(publishedNl.title).toBe('NL Published title')

    // The published en projection stays at its published value…
    const publishedEn = await read('posts', created.id, 'en', false)
    expect(publishedEn.title).toBe('Published title')

    // …and the pending en draft edit survives the locale publish.
    const draftEn = await read('posts', created.id, 'en', true)
    expect(draftEn.title).toBe('Draft edit')
  })

  it('flags a missing published translation even when its draft and sync record are complete', async () => {
    configureTranslationState([{ config: { fields: collectionFields, slug: 'posts' } }], [], {
      defaultLocale: 'en',
      locales: ['en', 'nl'],
    })
    const created = await payload.create({
      collection: 'posts',
      locale: 'en',
      data: { _status: 'published', title: 'Ruitenberg' },
    })
    await payload.update({
      collection: 'posts',
      id: created.id,
      locale: 'nl',
      draft: true,
      data: { title: 'Nederlandse concepttitel' },
    })
    await recordSyncSnapshot(payload, {
      locale: 'nl',
      target: `posts:${created.id}`,
      snapshot: buildSyncSnapshot([textChunk('title', 'Ruitenberg')]),
    })
    expect((await read('posts', created.id, 'nl', true)).title).toBe('Nederlandse concepttitel')
    expect((await read('posts', created.id, 'nl', false)).title).toBeFalsy()

    const req = await createLocalReq({ user: { id: 1, collection: 'users' } as any }, payload)
    req.json = async () => ({ collection: 'posts', id: created.id })
    const response = await createSyncStatusDocumentHandler()(req)
    expect((await response!.json()).status.locales[0]).toMatchObject({
      status: 'out-of-sync',
      missingFields: 1,
    })

    const events = await runStream({
      collection: 'posts',
      id: created.id,
      from: 'en',
      locales: [{ code: 'nl', chunks: [[textChunk('title', 'Ruitenberg')]] }],
    })
    expect(events).toContainEqual({ type: 'applied', locale: 'nl' })
    expect((await read('posts', created.id, 'nl', false)).title).toBe('NL Ruitenberg')
    const repaired = await createSyncStatusDocumentHandler()(req)
    expect((await repaired!.json()).status.locales[0]).toMatchObject({
      status: 'synced',
      changedFields: 0,
    })
  })
})
