import { describe, expect, test } from 'vitest'

import {
  buildSyncSnapshot,
  buildTargetKey,
  computeLocaleStatuses,
  countSnapshotChanges,
  hashSnapshotText,
  findMissingLocaleFields,
} from '../../src/server/syncStatusStore.js'

describe('buildTargetKey', () => {
  test('builds collection and global keys', () => {
    expect(buildTargetKey({ collection: 'posts', documentId: 12 })).toBe('posts:12')
    expect(buildTargetKey({ collection: 'posts', documentId: 'abc' })).toBe('posts:abc')
    expect(buildTargetKey({ global: 'header' })).toBe('global:header')
  })
})

describe('buildSyncSnapshot', () => {
  test('hashes item text deterministically', () => {
    const items = [
      { lexical: false, path: 'title', text: 'Hello world' },
      { lexical: true, path: 'content', text: '[[LEX-0]]Body[[/LEX-0]]' },
    ]

    const snapshot = buildSyncSnapshot(items)

    expect(snapshot).toEqual([
      { hash: hashSnapshotText('Hello world'), lexical: false, path: 'title' },
      { hash: hashSnapshotText('[[LEX-0]]Body[[/LEX-0]]'), lexical: true, path: 'content' },
    ])
    expect(buildSyncSnapshot(items)).toEqual(snapshot)
  })
})

describe('countSnapshotChanges', () => {
  const base = buildSyncSnapshot([
    { lexical: false, path: 'title', text: 'Hello' },
    { lexical: false, path: 'intro', text: 'Welcome' },
  ])

  test('returns zero for identical content', () => {
    expect(countSnapshotChanges(base, base)).toBe(0)
  })

  test('counts edited fields', () => {
    const current = buildSyncSnapshot([
      { lexical: false, path: 'title', text: 'Hello there' },
      { lexical: false, path: 'intro', text: 'Welcome' },
    ])

    expect(countSnapshotChanges(current, base)).toBe(1)
  })

  test('counts added and removed fields', () => {
    const current = buildSyncSnapshot([
      { lexical: false, path: 'title', text: 'Hello' },
      { lexical: false, path: 'outro', text: 'Bye' },
    ])

    // intro removed + outro added
    expect(countSnapshotChanges(current, base)).toBe(2)
  })

  test('treats lexical flag as part of the identity', () => {
    const current = buildSyncSnapshot([
      { lexical: true, path: 'title', text: 'Hello' },
      { lexical: false, path: 'intro', text: 'Welcome' },
    ])

    // title switched from plain to lexical: old entry removed + new entry added
    expect(countSnapshotChanges(current, base)).toBe(2)
  })
})

describe('computeLocaleStatuses', () => {
  const current = buildSyncSnapshot([{ lexical: false, path: 'title', text: 'Hello' }])

  test('reports never-synced locales with all fields as changed', () => {
    const [status] = computeLocaleStatuses(current, [], ['nl'])

    expect(status).toEqual({ changedFields: 1, locale: 'nl', status: 'never-synced' })
  })

  test('reports synced when the snapshot matches', () => {
    const [status] = computeLocaleStatuses(
      current,
      [{ locale: 'nl', snapshot: current, syncedAt: '2026-07-01T00:00:00.000Z' }],
      ['nl'],
    )

    expect(status).toEqual({
      changedFields: 0,
      locale: 'nl',
      status: 'synced',
      syncedAt: '2026-07-01T00:00:00.000Z',
    })
  })

  test('reports out-of-sync when content changed after the last sync', () => {
    const stored = buildSyncSnapshot([{ lexical: false, path: 'title', text: 'Old title' }])
    const [status] = computeLocaleStatuses(
      current,
      [{ locale: 'nl', snapshot: stored, syncedAt: '2026-07-01T00:00:00.000Z' }],
      ['nl'],
    )

    expect(status.status).toBe('out-of-sync')
    expect(status.changedFields).toBe(1)
  })

  test('treats documents without translatable content as synced', () => {
    const [status] = computeLocaleStatuses([], [], ['nl'])

    expect(status).toEqual({ changedFields: 0, locale: 'nl', status: 'synced' })
  })

  test('flags missing translations even when the source snapshot still matches', () => {
    const [status] = computeLocaleStatuses(
      current,
      [{ locale: 'nl', snapshot: current }],
      ['nl'],
      new Map([['nl', ['title']]]),
    )
    expect(status).toMatchObject({ changedFields: 1, missingFields: 1, status: 'out-of-sync' })
  })

  test('does not double-count fields that changed and are also missing', () => {
    const stored = buildSyncSnapshot([{ lexical: false, path: 'title', text: 'Old' }])
    const [status] = computeLocaleStatuses(
      current,
      [{ locale: 'nl', snapshot: stored }],
      ['nl'],
      new Map([['nl', ['title', 'title']]]),
    )
    expect(status).toMatchObject({ changedFields: 1, missingFields: 1, status: 'out-of-sync' })
  })

  test('keeps completeness checks independent for each locale', () => {
    const statuses = computeLocaleStatuses(
      current,
      ['nl', 'de'].map((locale) => ({ locale, snapshot: current })),
      ['nl', 'de'],
      new Map([['nl', ['title']]]),
    )
    expect(statuses.map((status) => status.status)).toEqual(['out-of-sync', 'synced'])
  })
})

describe('findMissingLocaleFields', () => {
  const items = [{ lexical: false, path: 'title', text: 'Hello' }]

  test.each([undefined, {}, { title: null }, { title: '' }, { title: '  \n ' }])(
    'detects an absent or empty title: %j',
    (translated) => {
      expect(findMissingLocaleFields({ title: 'Hello' }, translated, items)).toEqual(['title'])
    },
  )

  test('accepts existing translations and intentionally unchanged brand names', () => {
    expect(findMissingLocaleFields({ title: 'Hello' }, { title: 'Hallo' }, items)).toEqual([])
    expect(findMissingLocaleFields({ title: 'Hello' }, { title: 'Hello' }, items)).toEqual([])
  })

  test('detects empty rich text and nested fields', () => {
    const richText = { root: { type: 'root', children: [{ type: 'paragraph', children: [] }] } }
    expect(
      findMissingLocaleFields({}, { body: richText, meta: {} }, [
        { lexical: true, path: 'body', text: 'Body' },
        { lexical: false, path: 'meta.title', text: 'SEO title' },
      ]),
    ).toEqual(['body', 'meta.title'])
  })

  test('matches shared rows by id, including deleted and reordered rows', () => {
    const source = {
      rows: [
        { id: 'a', title: 'A' },
        { id: 'b', title: 'B' },
      ],
    }
    const rowItems = [0, 1].map((i) => ({ lexical: false, path: `rows.${i}.title`, text: 'Text' }))
    expect(
      findMissingLocaleFields(source, { rows: [{ id: 'b', title: 'B nl' }] }, rowItems),
    ).toEqual(['rows.0.title'])
    expect(
      findMissingLocaleFields(
        source,
        {
          rows: [
            { id: 'b', title: 'B nl' },
            { id: 'a', title: 'A nl' },
          ],
        },
        rowItems,
      ),
    ).toEqual([])
  })

  test('accepts locale-specific row ids inside localized containers', () => {
    expect(
      findMissingLocaleFields(
        { rows: [{ id: 'en-row', title: 'Hello' }] },
        { rows: [{ id: 'nl-row', title: 'Hallo' }] },
        [{ lexical: false, path: 'rows.0.title', text: 'Hello' }],
        ['rows'],
      ),
    ).toEqual([])
  })
})
