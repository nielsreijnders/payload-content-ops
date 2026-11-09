import { describe, expect, it } from 'vitest'

import { findMissingTranslation } from '../../src/server/saveVerification.js'

const lexical = (text: string) => ({
  root: {
    children: [
      {
        children: [{ text, type: 'text', version: 1 }],
        type: 'paragraph',
        version: 1,
      },
    ],
    direction: null,
    format: '',
    indent: 0,
    type: 'root',
    version: 1,
  },
})

describe('findMissingTranslation', () => {
  it('returns null when every translated value persisted', () => {
    const result = findMissingTranslation({
      expectedData: { layout: [{ title: 'Hallo wereld' }], title: 'Hallo' },
      paths: ['title', 'layout.0.title'],
      persistedDoc: { layout: [{ title: 'Hallo wereld' }], title: 'Hallo' },
    })

    expect(result).toBeNull()
  })

  it('flags a value that is missing from the persisted document', () => {
    const result = findMissingTranslation({
      expectedData: { title: 'Hallo wereld' },
      paths: ['title'],
      persistedDoc: { id: '1' },
    })

    expect(result).toEqual({ expected: 'Hallo wereld', path: 'title' })
  })

  it('flags a value that persisted as an empty string', () => {
    const result = findMissingTranslation({
      expectedData: { title: 'Hallo wereld' },
      paths: ['title'],
      persistedDoc: { title: '   ' },
    })

    expect(result).toEqual({ expected: 'Hallo wereld', path: 'title' })
  })

  it('tolerates textual differences so hooks may normalize values', () => {
    const result = findMissingTranslation({
      expectedData: { title: 'Hallo wereld' },
      paths: ['title'],
      persistedDoc: { title: 'Hallo Wereld!' },
    })

    expect(result).toBeNull()
  })

  it('compares lexical rich text by extracted plain text', () => {
    expect(
      findMissingTranslation({
        expectedData: { body: lexical('Vertaalde tekst') },
        paths: ['body'],
        persistedDoc: { body: lexical('Vertaalde tekst') },
      }),
    ).toBeNull()

    expect(
      findMissingTranslation({
        expectedData: { body: lexical('Vertaalde tekst') },
        paths: ['body'],
        persistedDoc: { id: '1' },
      }),
    ).toEqual({ expected: 'Vertaalde tekst', path: 'body' })
  })

  it('skips paths whose expected value is empty', () => {
    const result = findMissingTranslation({
      expectedData: { subtitle: '', title: undefined },
      paths: ['title', 'subtitle'],
      persistedDoc: { id: '1' },
    })

    expect(result).toBeNull()
  })

  it('detects missing fields beyond the first three paths', () => {
    const paths = Array.from({ length: 5 }, (_, i) => `field${i}`)
    const expectedData = Object.fromEntries(paths.map((path) => [path, 'waarde']))
    const persistedDoc = Object.fromEntries(paths.slice(0, 3).map((path) => [path, 'waarde']))

    expect(findMissingTranslation({ expectedData, paths, persistedDoc })).toEqual({
      expected: 'waarde',
      path: 'field3',
    })
  })
})
