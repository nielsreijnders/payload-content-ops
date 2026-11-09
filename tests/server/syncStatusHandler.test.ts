import type { CollectionConfig, GlobalConfig } from 'payload'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createSyncStatusDocumentHandler,
  createSyncStatusScanHandler,
} from '../../src/server/syncStatusHandler.js'
import { buildSyncSnapshot } from '../../src/server/syncStatusStore.js'
import { configureTranslationState } from '../../src/server/translationStateStore.js'

const source = { id: 27, _status: 'published', title: 'Ruitenberg', slug: '/cases/ruitenberg' }
const snapshot = buildSyncSnapshot([{ lexical: false, path: 'title', text: source.title }])

function setup({ missing = true, draft = false, fail = false } = {}) {
  const baseDoc = { ...source, _status: draft ? 'draft' : 'published' }
  const targetDoc = { id: 27, title: missing ? null : 'Ruitenberg NL' }
  const record = { locale: 'nl', snapshot, target: 'cases:27' }
  const payload = {
    count: vi.fn(async () => ({ totalDocs: 1 })),
    find: vi.fn(async (args: any) => {
      if (args.collection === 'ai-translation-sync') return { docs: [record] }
      if (args.locale === 'en') return { docs: [baseDoc], hasNextPage: false }
      // Mimic Payload's req mutation; the scanner must restore it.
      args.req.locale = args.locale
      args.req.fallbackLocale = false
      if (fail) throw new Error('Locale access denied')
      // A filled draft/fallback must not conceal a hole in published NL.
      const doc =
        args.draft || args.fallbackLocale !== false
          ? { ...targetDoc, title: 'Draft/fallback title' }
          : targetDoc
      return { docs: [doc], hasNextPage: false }
    }),
    findByID: vi.fn(async () => baseDoc),
    findGlobal: vi.fn(async (args: any) => {
      if (args.locale === 'en') return baseDoc
      if (fail) throw new Error('Locale access denied')
      return targetDoc
    }),
  }
  const req = {
    fallbackLocale: 'en',
    json: async () => ({ collection: 'cases', id: 27 }),
    locale: 'en',
    payload,
    user: { id: 1 },
  }
  return { payload, req }
}

beforeEach(() => {
  const fields: CollectionConfig['fields'] = [
    { name: 'title', type: 'text', localized: true },
    { name: 'slug', type: 'text', localized: true },
  ]
  configureTranslationState(
    [{ config: { fields, slug: 'cases' } as CollectionConfig, excludeFields: ['slug'] }],
    [{ config: { fields, slug: 'footer' } as GlobalConfig, excludeFields: ['slug'] }],
    { defaultLocale: 'en', locales: ['en', 'nl'] },
  )
})

describe('sync status completeness', () => {
  it('flags a missing published title in the document-level status despite a matching snapshot', async () => {
    const { payload, req } = setup()
    const response = await createSyncStatusDocumentHandler()(req as any)
    expect((await response!.json()).status.locales).toEqual([
      { changedFields: 1, missingFields: 1, locale: 'nl', status: 'out-of-sync' },
    ])
    expect(payload.find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'cases',
        draft: false,
        fallbackLocale: false,
        locale: 'nl',
        overrideAccess: false,
        where: { id: { in: [27] } },
      }),
    )
    expect(req.locale).toBe('en')
    expect(req.fallbackLocale).toBe('en')
  })

  it('keeps complete translations synced and ignores excluded slugs', async () => {
    const { req } = setup({ missing: false })
    const response = await createSyncStatusDocumentHandler()(req as any)
    expect((await response!.json()).status.locales[0]).toMatchObject({
      changedFields: 0,
      status: 'synced',
    })
  })

  it('checks the saved draft for a draft source', async () => {
    const { payload, req } = setup({ draft: true })
    const response = await createSyncStatusDocumentHandler()(req as any)
    expect((await response!.json()).status.locales[0].status).toBe('synced')
    expect(payload.find).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'cases', locale: 'nl', draft: true }),
    )
  })

  it('flags missing fields in the bulk scan and counts the document as needing sync', async () => {
    const { payload, req } = setup()
    const response = await createSyncStatusScanHandler()({
      ...req,
      json: async () => ({ collections: ['cases'] }),
    } as any)
    const events = (await response!.text())
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line))
    expect(events).toContainEqual(
      expect.objectContaining({
        type: 'document-result',
        document: expect.objectContaining({
          id: 27,
          maxChangedFields: 1,
          totalFields: 1,
          locales: [expect.objectContaining({ missingFields: 1, status: 'out-of-sync' })],
        }),
      }),
    )
    expect(events.at(-1)).toEqual({ type: 'scan-complete', outOfSync: 1, processed: 1 })
    expect(payload.find.mock.calls.filter(([args]) => args.locale === 'nl')).toHaveLength(1)
  })

  it.each(['document', 'scan'])('checks globals in the %s handler', async (mode) => {
    const { payload, req } = setup()
    payload.find.mockImplementation(
      async () => ({ docs: [{ locale: 'nl', snapshot, target: 'global:footer' }] }) as any,
    )
    const response =
      mode === 'document'
        ? await createSyncStatusDocumentHandler()({
            ...req,
            json: async () => ({ global: 'footer' }),
          } as any)
        : await createSyncStatusScanHandler()({
            ...req,
            json: async () => ({ globals: ['footer'] }),
          } as any)
    const status =
      mode === 'document'
        ? (await response!.json()).status
        : (await response!.text())
            .trim()
            .split('\n')
            .map((line) => JSON.parse(line))
            .find((event) => event.type === 'document-result').document
    expect(status.locales[0]).toMatchObject({ missingFields: 1, status: 'out-of-sync' })
    expect(payload.findGlobal).toHaveBeenCalledWith(
      expect.objectContaining({
        slug: 'footer',
        draft: false,
        fallbackLocale: false,
        locale: 'nl',
        overrideAccess: false,
      }),
    )
  })

  it('does not report successful status when a target locale cannot be read', async () => {
    const { req } = setup({ fail: true })
    const response = await createSyncStatusDocumentHandler()(req as any)
    expect(response!.status).toBe(400)
    expect((await response!.json()).message).toBe('Locale access denied')
    expect(req.locale).toBe('en')
    expect(req.fallbackLocale).toBe('en')
  })

  it('reports a collection error rather than up-to-date results when a bulk locale read fails', async () => {
    const { req } = setup({ fail: true })
    const response = await createSyncStatusScanHandler()({
      ...req,
      json: async () => ({ collections: ['cases'] }),
    } as any)
    const events = (await response!.text())
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line))
    expect(events).toContainEqual({
      type: 'collection-error',
      collection: 'cases',
      message: 'Locale access denied',
    })
    expect(events.some((event) => event.type === 'document-result')).toBe(false)
  })
})
