import type { CollectionConfig, GlobalConfig, Payload } from 'payload'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { TranslateRequestPayload } from '../../src/server/translationTypes.js'

import { openAiTranslateTexts } from '../../src/server/openAiTranslationClient.js'
import { streamTranslations } from '../../src/server/translationStream.js'
import { configureTranslationState } from '../../src/server/translationStateStore.js'
import { serializeLexicalValue, splitLexicalText } from '../../src/utils/lexical.js'
import { MAX_CHARS_PER_CHUNK } from '../../src/utils/localizedFields.js'
import { tabbedBlockDocument } from '../fixtures/tabbedBlockLexical.js'

vi.mock('../../src/server/openAiTranslationClient.js', () => ({
  openAiTranslateTexts: vi.fn(),
}))

const translateTextsMock = vi.mocked(openAiTranslateTexts)

// The stream verifies saves by re-reading the target locale afterwards; these
// helpers make the payload mocks echo whatever was saved so that read sees it.
let savedLocaleData: Record<string, Record<string, unknown> | undefined> = {}

const recordSave = <T extends { data?: unknown; locale?: unknown }>(args: T): T => {
  savedLocaleData[String(args.locale)] = args.data as Record<string, unknown>
  return args
}

const savedFor = (locale: unknown): Record<string, unknown> => savedLocaleData[String(locale)] ?? {}

describe('streamTranslations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    savedLocaleData = {}
    configureTranslationState([], { defaultLocale: 'en', locales: ['en', 'nl'] })
  })

  it('preserves blockType metadata when translating block fields', async () => {
    const baseDoc = {
      id: '1',
      layout: [
        {
          blockType: 'hero',
          title: 'Hello world',
        },
      ],
    }

    const payloadMock = {
      findByID: vi.fn<Payload['findByID']>().mockImplementation(async ({ locale }) => {
        if (locale === 'en') {
          return baseDoc
        }

        return { id: '1', ...savedFor(locale) }
      }),
      logger: {
        error: vi.fn(),
        info: vi.fn(),
      },
      update: vi.fn<Payload['update']>(async (args) => recordSave(args)),
    } satisfies Partial<Payload>

    translateTextsMock.mockResolvedValueOnce(['Hallo wereld'])

    const request: TranslateRequestPayload = {
      id: '1',
      collection: 'pages',
      from: 'en',
      locales: [
        {
          chunks: [
            [
              {
                lexical: false,
                path: 'layout.0.title',
                text: 'Hello world',
              },
            ],
          ],
          code: 'nl',
        },
      ],
    }

    const events: unknown[] = []
    for await (const event of streamTranslations(payloadMock as Payload, request)) {
      events.push(event)
    }

    expect(translateTextsMock).toHaveBeenCalledWith(
      ['Hello world'],
      'en',
      'nl',
      expect.objectContaining({ customPrompt: undefined }),
    )
    expect(payloadMock.update).toHaveBeenCalledTimes(1)
    expect(payloadMock.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: '1',
        collection: 'pages',
        data: expect.objectContaining({
          layout: [
            {
              blockType: 'hero',
              title: 'Hallo wereld',
            },
          ],
        }),
        locale: 'nl',
        overrideAccess: true,
      }),
    )

    expect(events).toEqual([
      { type: 'progress', completed: 1, locale: 'nl', total: 1 },
      { type: 'applied', locale: 'nl' },
      { type: 'done' },
    ])
  })

  it('omits metadata fields when saving globals', async () => {
    configureTranslationState(
      [],
      [
        {
          config: {
            fields: [],
            label: 'Navigation',
            slug: 'menu',
          } as GlobalConfig,
        },
      ],
      { defaultLocale: 'en', locales: ['en', 'nl'] },
    )

    const baseDoc = {
      id: 'global:menu',
      links: {
        title: 'Menu',
      },
    }

    const payloadMock = {
      findGlobal: vi.fn<Payload['findGlobal']>().mockImplementation(async ({ locale }) => {
        if (locale === 'en') {
          return baseDoc
        }

        return { id: 'global:menu', ...savedFor(locale) }
      }),
      logger: {
        error: vi.fn(),
        info: vi.fn(),
      },
      updateGlobal: vi.fn<Payload['updateGlobal']>(async (args) => recordSave(args)),
    } satisfies Partial<Payload>

    translateTextsMock.mockResolvedValueOnce(['Menukaart'])

    const request: TranslateRequestPayload = {
      from: 'en',
      global: 'menu',
      locales: [
        {
          chunks: [
            [
              {
                lexical: false,
                path: 'links.title',
                text: 'Menu',
              },
            ],
          ],
          code: 'nl',
        },
      ],
    }

    const events: unknown[] = []
    for await (const event of streamTranslations(payloadMock as Payload, request)) {
      events.push(event)
    }

    expect(payloadMock.updateGlobal).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { links: { title: 'Menukaart' } },
        locale: 'nl',
        overrideAccess: true,
        slug: 'menu',
      }),
    )
    expect(payloadMock.updateGlobal).toHaveBeenCalledTimes(1)

    const savedPayload = payloadMock.updateGlobal.mock.calls.at(0)?.at(0)
    expect(savedPayload?.data).not.toHaveProperty('id')
    expect(savedPayload?.data).not.toHaveProperty('_id')

    expect(events).toEqual([
      { type: 'progress', completed: 1, locale: 'nl', total: 1 },
      { type: 'applied', locale: 'nl' },
      { type: 'done' },
    ])
  })

  it('preserves top-level identifiers when translating globals', async () => {
    configureTranslationState(
      [],
      [
        {
          config: {
            fields: [],
            label: 'Navigation',
            slug: 'menu',
          } as GlobalConfig,
        },
      ],
      { defaultLocale: 'en', locales: ['en', 'nl'] },
    )

    const baseDoc = {
      id: 'global:menu',
      links: [
        { id: 'link-1', link: { label: 'Menu' } },
        { id: 'link-2', link: { label: 'About' } },
      ],
    }

    const payloadMock = {
      findGlobal: vi.fn<Payload['findGlobal']>().mockImplementation(async ({ locale }) => {
        if (locale === 'en') {
          return baseDoc
        }

        return { id: 'global:menu', ...savedFor(locale) }
      }),
      logger: {
        error: vi.fn(),
        info: vi.fn(),
      },
      updateGlobal: vi.fn<Payload['updateGlobal']>(async (args) => recordSave(args)),
    } satisfies Partial<Payload>

    translateTextsMock.mockResolvedValueOnce(['Menukaart', 'link-1'])

    const request: TranslateRequestPayload = {
      from: 'en',
      global: 'menu',
      locales: [
        {
          chunks: [
            [
              {
                lexical: false,
                path: 'links.0.link.label',
                text: 'Menu',
              },
            ],
          ],
          code: 'nl',
          identifierPaths: ['links.0.id'],
        },
      ],
    }

    for await (const _event of streamTranslations(payloadMock as Payload, request)) {
      // exhaust iterator
    }

    expect(payloadMock.updateGlobal).toHaveBeenCalledTimes(1)
    const savedPayload = payloadMock.updateGlobal.mock.calls.at(0)?.at(0)
    expect(savedPayload?.data).toEqual({
      links: [
        { id: 'link-1', link: { label: 'Menukaart' } },
        { id: 'link-2', link: { label: 'About' } },
      ],
    })
  })

  it('preserves global row identifiers even when they are not part of the translation payload', async () => {
    configureTranslationState(
      [],
      [
        {
          config: {
            fields: [],
            label: 'Navigation',
            slug: 'menu',
          } as GlobalConfig,
        },
      ],
      { defaultLocale: 'en', locales: ['en', 'nl'] },
    )

    const baseDoc = {
      id: 'global:menu',
      links: [
        { id: 'link-1', link: { label: 'Menu' } },
        { id: 'link-2', link: { label: 'About' } },
      ],
    }

    const payloadMock = {
      findGlobal: vi.fn<Payload['findGlobal']>().mockImplementation(async ({ locale }) => {
        if (locale === 'en') {
          return baseDoc
        }

        return { id: 'global:menu', ...savedFor(locale) }
      }),
      logger: {
        error: vi.fn(),
        info: vi.fn(),
      },
      updateGlobal: vi.fn<Payload['updateGlobal']>(async (args) => recordSave(args)),
    } satisfies Partial<Payload>

    translateTextsMock.mockResolvedValueOnce(['Menukaart'])

    const request: TranslateRequestPayload = {
      from: 'en',
      global: 'menu',
      locales: [
        {
          chunks: [
            [
              {
                lexical: false,
                path: 'links.0.link.label',
                text: 'Menu',
              },
            ],
          ],
          code: 'nl',
        },
      ],
    }

    for await (const _event of streamTranslations(payloadMock as Payload, request)) {
      // exhaust iterator
    }

    expect(payloadMock.updateGlobal).toHaveBeenCalledTimes(1)
    const savedPayload = payloadMock.updateGlobal.mock.calls.at(0)?.at(0)
    expect(savedPayload?.data).toEqual({
      links: [
        { id: 'link-1', link: { label: 'Menukaart' } },
        { id: 'link-2', link: { label: 'About' } },
      ],
    })
    expect(savedPayload?.data).not.toHaveProperty('id')
    expect(savedPayload?.data).not.toHaveProperty('_id')
  })

  it('strips ids inside localized containers but keeps shared row ids', async () => {
    // `links` is a shared (non-localized) array whose rows carry localized
    // subfields: its row ids MUST survive the save, or Payload recreates the
    // rows and silently wipes the other locales' values. `sublinks` is a
    // localized array: its rows mirror the default locale's rows, so their
    // ids must be dropped to give the target locale rows of its own.
    const navigationLikeGlobal = (slug: string): GlobalConfig =>
      ({
        fields: [
          {
            name: 'links',
            type: 'array',
            fields: [
              {
                name: 'link',
                type: 'group',
                fields: [{ name: 'label', type: 'text', localized: true }],
              },
              {
                name: 'sublinks',
                type: 'array',
                localized: true,
                fields: [
                  {
                    name: 'link',
                    type: 'group',
                    fields: [{ name: 'label', type: 'text', localized: true }],
                  },
                ],
              },
            ],
          },
        ],
        label: 'Navigation',
        slug,
      }) as GlobalConfig

    configureTranslationState([], [{ config: navigationLikeGlobal('menu') }], {
      defaultLocale: 'en',
      locales: ['en', 'nl'],
    })

    const baseDoc = {
      id: 'global:menu',
      links: [
        {
          id: 'link-1',
          link: { label: 'Menu' },
          sublinks: [{ id: 'sub-1', link: { label: 'Market Map' } }],
        },
        {
          id: 'link-2',
          link: { label: 'About' },
          sublinks: [{ id: 'sub-2', link: { label: 'Contact' } }],
        },
      ],
    }

    const payloadMock = {
      findGlobal: vi.fn<Payload['findGlobal']>().mockImplementation(async ({ locale }) => {
        if (locale === 'en') {
          return baseDoc
        }

        return { id: 'global:menu', ...savedFor(locale) }
      }),
      logger: {
        error: vi.fn(),
        info: vi.fn(),
      },
      updateGlobal: vi.fn<Payload['updateGlobal']>(async (args) => recordSave(args)),
    } satisfies Partial<Payload>

    translateTextsMock.mockResolvedValueOnce(['Marktkaart'])

    const request: TranslateRequestPayload = {
      from: 'en',
      global: 'menu',
      locales: [
        {
          chunks: [
            [
              {
                lexical: false,
                path: 'links.0.sublinks.0.link.label',
                text: 'Market Map',
              },
            ],
          ],
          code: 'nl',
          identifierPaths: [
            'links.0.id',
            'links.0.sublinks.0.id',
            'links.1.id',
            'links.1.sublinks.0.id',
          ],
        },
      ],
    }

    for await (const _event of streamTranslations(payloadMock as Payload, request)) {
      // exhaust iterator
    }

    expect(payloadMock.updateGlobal).toHaveBeenCalledTimes(1)
    const savedPayload = payloadMock.updateGlobal.mock.calls.at(0)?.at(0)
    expect(savedPayload?.data).toEqual({
      links: [
        {
          id: 'link-1',
          link: { label: 'Menu' },
          sublinks: [{ link: { label: 'Marktkaart' } }],
        },
        {
          id: 'link-2',
          link: { label: 'About' },
          sublinks: [{ link: { label: 'Contact' } }],
        },
      ],
    })
  })

  it('keeps nested row ids when no localized containers are configured', async () => {
    // Without a localized container in the config every array is shared
    // across locales — stripping ANY row id here is what wiped default-locale
    // content in production, so every id must survive.
    configureTranslationState(
      [],
      [
        {
          config: {
            fields: [],
            label: 'Navigation',
            slug: 'menu',
          } as GlobalConfig,
        },
      ],
      { defaultLocale: 'en', locales: ['en', 'nl'] },
    )

    const baseDoc = {
      id: 'global:menu',
      links: [
        {
          id: 'link-1',
          link: { label: 'Menu' },
          sublinks: [{ id: 'sub-1', link: { label: 'Market Map' } }],
        },
      ],
    }

    const payloadMock = {
      findGlobal: vi.fn<Payload['findGlobal']>().mockImplementation(async ({ locale }) => {
        if (locale === 'en') {
          return baseDoc
        }

        return { id: 'global:menu', ...savedFor(locale) }
      }),
      logger: {
        error: vi.fn(),
        info: vi.fn(),
      },
      updateGlobal: vi.fn<Payload['updateGlobal']>(async (args) => recordSave(args)),
    } satisfies Partial<Payload>

    translateTextsMock.mockResolvedValueOnce(['Marktkaart'])

    const request: TranslateRequestPayload = {
      from: 'en',
      global: 'menu',
      locales: [
        {
          chunks: [
            [
              {
                lexical: false,
                path: 'links.0.sublinks.0.link.label',
                text: 'Market Map',
              },
            ],
          ],
          code: 'nl',
          identifierPaths: ['links.0.id', 'links.0.sublinks.0.id'],
        },
      ],
    }

    for await (const _event of streamTranslations(payloadMock as Payload, request)) {
      // exhaust iterator
    }

    expect(payloadMock.updateGlobal).toHaveBeenCalledTimes(1)
    const savedPayload = payloadMock.updateGlobal.mock.calls.at(0)?.at(0)
    expect(savedPayload?.data).toEqual({
      links: [
        {
          id: 'link-1',
          link: { label: 'Menu' },
          sublinks: [{ id: 'sub-1', link: { label: 'Marktkaart' } }],
        },
      ],
    })
  })

  it('applies custom prompt instructions when configured', async () => {
    const baseDoc = {
      id: '1',
      layout: [
        {
          blockType: 'hero',
          title: 'Hello world',
        },
      ],
    }

    configureTranslationState(
      [
        {
          config: {
            fields: [],
            slug: 'pages',
          } as CollectionConfig,
          customPrompt: (data) =>
            `Keep original title: ${(data as { layout: { title: string }[] }).layout?.[0]?.title}`,
        },
      ],
      { defaultLocale: 'en', locales: ['en', 'nl'] },
    )

    const payloadMock = {
      findByID: vi.fn<Payload['findByID']>().mockImplementation(async ({ locale }) => {
        if (locale === 'en') {
          return baseDoc
        }

        return { id: '1', ...savedFor(locale) }
      }),
      logger: {
        error: vi.fn(),
        info: vi.fn(),
      },
      update: vi.fn<Payload['update']>(async (args) => recordSave(args)),
    } satisfies Partial<Payload>

    translateTextsMock.mockResolvedValueOnce(['Hallo wereld'])

    const request: TranslateRequestPayload = {
      id: '1',
      collection: 'pages',
      from: 'en',
      locales: [
        {
          chunks: [
            [
              {
                lexical: false,
                path: 'layout.0.title',
                text: 'Hello world',
              },
            ],
          ],
          code: 'nl',
        },
      ],
    }

    const events: unknown[] = []
    for await (const event of streamTranslations(payloadMock as Payload, request)) {
      events.push(event)
    }

    expect(translateTextsMock).toHaveBeenCalledWith(
      ['Hello world'],
      'en',
      'nl',
      expect.objectContaining({ customPrompt: 'Keep original title: Hello world' }),
    )

    expect(events).toContainEqual({ type: 'applied', locale: 'nl' })
  })

  it('strips document identifiers before saving translations', async () => {
    const baseDoc = {
      id: 91,
      title: 'Example product',
    }

    const payloadMock = {
      findByID: vi.fn<Payload['findByID']>().mockResolvedValue(baseDoc),
      logger: {
        error: vi.fn(),
        info: vi.fn(),
      },
      update: vi.fn<Payload['update']>(async (args) => recordSave(args)),
    } satisfies Partial<Payload>

    translateTextsMock.mockResolvedValueOnce(['Voorbeeld product'])

    const request: TranslateRequestPayload = {
      id: 91,
      collection: 'products',
      from: 'en',
      locales: [
        {
          chunks: [
            [
              {
                lexical: false,
                path: 'title',
                text: 'Example product',
              },
            ],
          ],
          code: 'nl',
        },
      ],
    }

    for await (const _event of streamTranslations(payloadMock as Payload, request)) {
      // exhaust generator
    }

    expect(payloadMock.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({ id: expect.anything(), _id: expect.anything() }),
      }),
    )
  })

  it('copies missing flexible content blocks from the base document', async () => {
    const baseDoc = {
      id: '2',
      layout: [
        {
          blockType: 'hero',
          title: 'Primary heading',
        },
        {
          blockType: 'divider',
          style: 'simple',
        },
      ],
    }

    const payloadMock = {
      findByID: vi.fn<Payload['findByID']>().mockImplementation(async ({ locale }) => {
        if (locale === 'en') {
          return baseDoc
        }

        return { id: '2', ...savedFor(locale) }
      }),
      logger: {
        error: vi.fn(),
        info: vi.fn(),
      },
      update: vi.fn<Payload['update']>(async (args) => recordSave(args)),
    } satisfies Partial<Payload>

    translateTextsMock.mockResolvedValueOnce(['Primaire heading'])

    const request: TranslateRequestPayload = {
      id: '2',
      collection: 'pages',
      from: 'en',
      locales: [
        {
          chunks: [
            [
              {
                lexical: false,
                path: 'layout.0.title',
                text: 'Primary heading',
              },
            ],
          ],
          code: 'nl',
        },
      ],
    }

    const events: unknown[] = []
    for await (const event of streamTranslations(payloadMock as Payload, request)) {
      events.push(event)
    }

    expect(payloadMock.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          layout: [
            {
              blockType: 'hero',
              title: 'Primaire heading',
            },
            {
              blockType: 'divider',
              style: 'simple',
            },
          ],
        }),
        id: '2',
        locale: 'nl',
      }),
    )

    expect(events).toEqual([
      { type: 'progress', completed: 1, locale: 'nl', total: 1 },
      { type: 'applied', locale: 'nl' },
      { type: 'done' },
    ])
  })

  it('aligns flexible content by block identity before applying translations', async () => {
    const baseDoc = {
      id: '3',
      layout: [
        {
          _id: 'hero-1',
          blockType: 'hero',
          title: 'Primary heading',
        },
        {
          _id: 'feature-1',
          blockType: 'feature',
          title: 'Key features',
        },
      ],
    }

    const payloadMock = {
      findByID: vi.fn<Payload['findByID']>().mockImplementation(async ({ locale }) => {
        if (locale === 'en') {
          return baseDoc
        }

        return {
          id: '3',
          layout: [
            {
              _id: 'feature-1',
              blockType: 'feature',
              title: 'Key features',
            },
            {
              _id: 'hero-1',
              blockType: 'hero',
              title: 'Primary heading',
            },
          ],
        }
      }),
      logger: {
        error: vi.fn(),
        info: vi.fn(),
      },
      update: vi.fn<Payload['update']>(async (args) => recordSave(args)),
    } satisfies Partial<Payload>

    translateTextsMock.mockResolvedValueOnce(['Primaire heading', 'Belangrijkste functies'])

    const request: TranslateRequestPayload = {
      id: '3',
      collection: 'pages',
      from: 'en',
      locales: [
        {
          chunks: [
            [
              {
                lexical: false,
                path: 'layout.0.title',
                text: 'Primary heading',
              },
              {
                lexical: false,
                path: 'layout.1.title',
                text: 'Key features',
              },
            ],
          ],
          code: 'nl',
        },
      ],
    }

    for await (const _event of streamTranslations(payloadMock as Payload, request)) {
      // drain iterator
    }

    expect(payloadMock.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          layout: [
            {
              _id: 'hero-1',
              blockType: 'hero',
              title: 'Primaire heading',
            },
            {
              _id: 'feature-1',
              blockType: 'feature',
              title: 'Belangrijkste functies',
            },
          ],
        }),
        id: '3',
        locale: 'nl',
      }),
    )
  })

  it('updates nested group fields with translated values', async () => {
    const baseDoc = {
      id: '1',
      settings: {
        hero: {
          headline: 'Greetings',
          nested: {
            description: 'Welcome visitor',
          },
        },
      },
    }

    const payloadMock = {
      findByID: vi.fn<Payload['findByID']>().mockImplementation(async ({ locale }) => {
        if (locale === 'en') {
          return baseDoc
        }

        return { id: '1', settings: {}, ...savedFor(locale) }
      }),
      logger: {
        error: vi.fn(),
        info: vi.fn(),
      },
      update: vi.fn<Payload['update']>(async (args) => recordSave(args)),
    } satisfies Partial<Payload>

    translateTextsMock.mockResolvedValueOnce(['Hallo daar', 'Welkom bezoeker'])

    const request: TranslateRequestPayload = {
      id: '1',
      collection: 'pages',
      from: 'en',
      locales: [
        {
          chunks: [
            [
              {
                lexical: false,
                path: 'settings.hero.headline',
                text: 'Greetings',
              },
              {
                lexical: false,
                path: 'settings.hero.nested.description',
                text: 'Welcome visitor',
              },
            ],
          ],
          code: 'nl',
        },
      ],
    }

    const events: unknown[] = []
    for await (const event of streamTranslations(payloadMock as Payload, request)) {
      events.push(event)
    }

    expect(translateTextsMock).toHaveBeenCalledWith(
      ['Greetings', 'Welcome visitor'],
      'en',
      'nl',
      expect.objectContaining({ customPrompt: undefined }),
    )

    expect(payloadMock.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          settings: {
            hero: {
              headline: 'Hallo daar',
              nested: {
                description: 'Welkom bezoeker',
              },
            },
          },
        }),
      }),
    )

    expect(events).toEqual([
      { type: 'progress', completed: 2, locale: 'nl', total: 2 },
      { type: 'applied', locale: 'nl' },
      { type: 'done' },
    ])
  })

  it('does not save unrelated nested fields when translating a top-level field', async () => {
    const baseDoc = {
      id: '37',
      heroes: [
        {
          blockType: 'HeroHome',
          globeTags: [
            {
              id: 'tag-1',
              image: 92,
              label: 'Agri Food',
            },
            {
              id: 'tag-2',
              image: 145,
              label: 'Healthy Food',
            },
          ],
        },
      ],
      title: 'Home',
    }

    const localeDoc = {
      heroes: [
        {
          blockType: 'HeroHome',
          globeTags: [
            {
              id: 'tag-1',
              image: 92,
              label: null,
            },
            {
              id: 'tag-2',
              image: 145,
            },
          ],
        },
      ],
      id: '37',
      title: 'Start',
    }

    const payloadMock = {
      findByID: vi.fn<Payload['findByID']>().mockImplementation(async ({ locale }) => {
        if (locale === 'en') {
          return baseDoc
        }

        return localeDoc
      }),
      logger: {
        error: vi.fn(),
        info: vi.fn(),
      },
      update: vi.fn<Payload['update']>(async (args) => recordSave(args)),
    } satisfies Partial<Payload>

    translateTextsMock.mockResolvedValueOnce(['Startpagina'])

    const request: TranslateRequestPayload = {
      id: '37',
      collection: 'pages',
      from: 'en',
      locales: [
        {
          chunks: [
            [
              {
                lexical: false,
                path: 'title',
                text: 'Home',
              },
            ],
          ],
          code: 'nl',
        },
      ],
    }

    const events: unknown[] = []
    for await (const event of streamTranslations(payloadMock as Payload, request)) {
      events.push(event)
    }

    expect(payloadMock.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          title: 'Startpagina',
        },
        id: '37',
        locale: 'nl',
      }),
    )
    expect(payloadMock.findByID).toHaveBeenCalledWith(
      expect.objectContaining({
        fallbackLocale: false,
        locale: 'nl',
      }),
    )

    expect(events).toEqual([
      { type: 'progress', completed: 1, locale: 'nl', total: 1 },
      { type: 'applied', locale: 'nl' },
      { type: 'done' },
    ])
  })

  it('does not save untranslated collection branches', async () => {
    const baseDoc = {
      components: [
        {
          blockType: 'refG',
          content: {
            links: [
              { id: 'link-1', link: { label: null } },
              { id: 'link-2', link: { label: null } },
            ],
          },
          id: 'component-1',
        },
      ],
      heroes: [
        {
          blockType: 'HeroText',
          heading: 'Hello world',
          id: 'hero-1',
        },
      ],
      id: '88',
    }

    const payloadMock = {
      findByID: vi.fn<Payload['findByID']>().mockImplementation(async ({ locale }) => {
        if (locale === 'en') {
          return baseDoc
        }

        return { id: '88', ...savedFor(locale) }
      }),
      logger: {
        error: vi.fn(),
        info: vi.fn(),
      },
      update: vi.fn<Payload['update']>(async (args) => recordSave(args)),
    } satisfies Partial<Payload>

    translateTextsMock.mockResolvedValueOnce(['Hallo wereld'])

    const request: TranslateRequestPayload = {
      id: '88',
      collection: 'pages',
      from: 'en',
      locales: [
        {
          chunks: [
            [
              {
                lexical: false,
                path: 'heroes.0.heading',
                text: 'Hello world',
              },
            ],
          ],
          code: 'nl',
        },
      ],
    }

    for await (const _event of streamTranslations(payloadMock as Payload, request)) {
      // exhaust generator
    }

    expect(payloadMock.update).toHaveBeenCalledTimes(1)
    expect(payloadMock.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          heroes: [
            {
              blockType: 'HeroText',
              heading: 'Hallo wereld',
              id: 'hero-1',
            },
          ],
        },
      }),
    )
  })

  it('strips collection identifiers under localized array containers only', async () => {
    configureTranslationState(
      [
        {
          config: {
            fields: [
              {
                blockReferences: ['Timeline', 'TextBlocks'],
                blocks: [],
                name: 'components',
                type: 'blocks',
              },
            ],
            slug: 'pages',
          } as CollectionConfig,
        },
      ],
      [],
      { defaultLocale: 'en', locales: ['en', 'nl'] },
      {
        availableBlocks: [
          {
            fields: [
              {
                fields: [
                  {
                    fields: [
                      {
                        name: 'title',
                        type: 'text',
                      },
                    ],
                    localized: true,
                    name: 'items',
                    type: 'array',
                  },
                ],
                name: 'content',
                type: 'group',
              },
            ],
            slug: 'Timeline',
          },
          {
            fields: [
              {
                fields: [
                  {
                    blockReferences: ['Text'],
                    blocks: [],
                    name: 'flexibleContent',
                    type: 'blocks',
                  },
                ],
                name: 'content',
                type: 'group',
              },
            ],
            slug: 'TextBlocks',
          },
          {
            fields: [
              {
                fields: [
                  {
                    localized: true,
                    name: 'content',
                    type: 'richText',
                  },
                ],
                name: 'content',
                type: 'group',
              },
            ],
            slug: 'Text',
          },
        ],
      },
    )

    const baseDoc = {
      components: [
        {
          blockType: 'Timeline',
          content: {
            items: [{ id: 'item-1', title: 'First item' }],
          },
          id: 'timeline-1',
        },
        {
          blockType: 'TextBlocks',
          content: {
            flexibleContent: [
              {
                blockType: 'Text',
                content: { content: 'Nested content' },
                id: 'flexible-1',
              },
            ],
          },
          id: 'text-blocks-1',
        },
      ],
      id: '88',
    }

    const payloadMock = {
      findByID: vi.fn<Payload['findByID']>().mockImplementation(async ({ locale }) => {
        if (locale === 'en') {
          return baseDoc
        }

        return { id: '88', ...savedFor(locale) }
      }),
      logger: {
        error: vi.fn(),
        info: vi.fn(),
      },
      update: vi.fn<Payload['update']>(async (args) => recordSave(args)),
    } satisfies Partial<Payload>

    translateTextsMock.mockResolvedValueOnce(['Eerste item', 'Geneste content'])

    const request: TranslateRequestPayload = {
      id: '88',
      collection: 'pages',
      from: 'en',
      locales: [
        {
          chunks: [
            [
              {
                lexical: false,
                path: 'components.0.content.items.0.title',
                text: 'First item',
              },
              {
                lexical: false,
                path: 'components.1.content.flexibleContent.0.content.content',
                text: 'Nested content',
              },
            ],
          ],
          code: 'nl',
        },
      ],
    }

    for await (const _event of streamTranslations(payloadMock as Payload, request)) {
      // exhaust generator
    }

    expect(payloadMock.update).toHaveBeenCalledTimes(1)
    expect(payloadMock.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          components: [
            {
              blockType: 'Timeline',
              content: {
                items: [{ title: 'Eerste item' }],
              },
              id: 'timeline-1',
            },
            {
              blockType: 'TextBlocks',
              content: {
                flexibleContent: [
                  {
                    blockType: 'Text',
                    content: { content: 'Geneste content' },
                    id: 'flexible-1',
                  },
                ],
              },
              id: 'text-blocks-1',
            },
          ],
        },
      }),
    )
  })

  it('batches multiple small chunks into a single translation request', async () => {
    const baseDoc = {
      id: '1',
      description: 'Short description',
      footer: 'Call us',
      title: 'Hello world',
    }

    const payloadMock = {
      findByID: vi.fn<Payload['findByID']>().mockImplementation(async ({ locale }) => {
        if (locale === 'en') {
          return baseDoc
        }

        return { id: '1', ...savedFor(locale) }
      }),
      logger: {
        error: vi.fn(),
        info: vi.fn(),
      },
      update: vi.fn<Payload['update']>(async (args) => recordSave(args)),
    } satisfies Partial<Payload>

    translateTextsMock.mockResolvedValueOnce(['Hallo wereld', 'Korte beschrijving', 'Bel ons'])

    const request: TranslateRequestPayload = {
      id: '1',
      collection: 'pages',
      from: 'en',
      locales: [
        {
          chunks: [
            [
              {
                lexical: false,
                path: 'title',
                text: 'Hello world',
              },
            ],
            [
              {
                lexical: false,
                path: 'description',
                text: 'Short description',
              },
            ],
            [
              {
                lexical: false,
                path: 'footer',
                text: 'Call us',
              },
            ],
          ],
          code: 'nl',
        },
      ],
    }

    const events: unknown[] = []
    for await (const event of streamTranslations(payloadMock as Payload, request)) {
      events.push(event)
    }

    expect(translateTextsMock).toHaveBeenCalledTimes(1)
    expect(translateTextsMock).toHaveBeenCalledWith(
      ['Hello world', 'Short description', 'Call us'],
      'en',
      'nl',
      expect.objectContaining({ customPrompt: undefined }),
    )

    expect(payloadMock.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          description: 'Korte beschrijving',
          footer: 'Bel ons',
          title: 'Hallo wereld',
        }),
      }),
    )

    expect(events).toEqual([
      { type: 'progress', completed: 1, locale: 'nl', total: 3 },
      { type: 'progress', completed: 2, locale: 'nl', total: 3 },
      { type: 'progress', completed: 3, locale: 'nl', total: 3 },
      { type: 'applied', locale: 'nl' },
      { type: 'done' },
    ])
  })

  it('falls back to individual chunk translations when a batch fails', async () => {
    const baseDoc = {
      id: '1',
      footer: 'Call us',
      title: 'Hello world',
    }

    const payloadMock = {
      findByID: vi.fn<Payload['findByID']>().mockImplementation(async ({ locale }) => {
        if (locale === 'en') {
          return baseDoc
        }

        return { id: '1', ...savedFor(locale) }
      }),
      logger: {
        error: vi.fn(),
        info: vi.fn(),
      },
      update: vi.fn<Payload['update']>(async (args) => recordSave(args)),
    } satisfies Partial<Payload>

    translateTextsMock
      .mockRejectedValueOnce(new Error('Batch failure'))
      .mockResolvedValueOnce(['Hallo wereld'])
      .mockResolvedValueOnce(['Bel ons'])

    const request: TranslateRequestPayload = {
      id: '1',
      collection: 'pages',
      from: 'en',
      locales: [
        {
          chunks: [
            [
              {
                lexical: false,
                path: 'title',
                text: 'Hello world',
              },
            ],
            [
              {
                lexical: false,
                path: 'footer',
                text: 'Call us',
              },
            ],
          ],
          code: 'nl',
        },
      ],
    }

    const events: unknown[] = []
    for await (const event of streamTranslations(payloadMock as Payload, request)) {
      events.push(event)
    }

    expect(translateTextsMock).toHaveBeenCalledTimes(3)
    expect(translateTextsMock).toHaveBeenNthCalledWith(
      1,
      ['Hello world', 'Call us'],
      'en',
      'nl',
      expect.objectContaining({ customPrompt: undefined }),
    )
    expect(translateTextsMock).toHaveBeenNthCalledWith(
      2,
      ['Hello world'],
      'en',
      'nl',
      expect.objectContaining({ customPrompt: undefined }),
    )
    expect(translateTextsMock).toHaveBeenNthCalledWith(
      3,
      ['Call us'],
      'en',
      'nl',
      expect.objectContaining({ customPrompt: undefined }),
    )

    expect(payloadMock.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          footer: 'Bel ons',
          title: 'Hallo wereld',
        }),
      }),
    )

    expect(events).toEqual([
      { type: 'progress', completed: 1, locale: 'nl', total: 2 },
      { type: 'progress', completed: 2, locale: 'nl', total: 2 },
      { type: 'applied', locale: 'nl' },
      { type: 'done' },
    ])
  })

  it('falls back to per-item translations when chunk translation fails', async () => {
    const baseDoc = {
      id: '1',
      settings: {
        hero: {
          headline: 'Greetings',
          nested: {
            description: 'Welcome visitor',
          },
        },
      },
    }

    const payloadMock = {
      findByID: vi.fn<Payload['findByID']>().mockImplementation(async ({ locale }) => {
        if (locale === 'en') {
          return baseDoc
        }

        return { id: '1', settings: {}, ...savedFor(locale) }
      }),
      logger: {
        error: vi.fn(),
        info: vi.fn(),
      },
      update: vi.fn<Payload['update']>(async (args) => recordSave(args)),
    } satisfies Partial<Payload>

    translateTextsMock
      .mockRejectedValueOnce(new Error('Batch failure'))
      .mockRejectedValueOnce(new Error('Chunk failure'))
      .mockResolvedValueOnce(['Hallo daar'])
      .mockResolvedValueOnce(['Welkom bezoeker'])

    const request: TranslateRequestPayload = {
      id: '1',
      collection: 'pages',
      from: 'en',
      locales: [
        {
          chunks: [
            [
              {
                lexical: false,
                path: 'settings.hero.headline',
                text: 'Greetings',
              },
              {
                lexical: false,
                path: 'settings.hero.nested.description',
                text: 'Welcome visitor',
              },
            ],
          ],
          code: 'nl',
        },
      ],
    }

    const events: unknown[] = []
    for await (const event of streamTranslations(payloadMock as Payload, request)) {
      events.push(event)
    }

    expect(translateTextsMock).toHaveBeenCalledTimes(4)
    expect(translateTextsMock).toHaveBeenNthCalledWith(
      1,
      ['Greetings', 'Welcome visitor'],
      'en',
      'nl',
      expect.objectContaining({ customPrompt: undefined }),
    )
    expect(translateTextsMock).toHaveBeenNthCalledWith(
      2,
      ['Greetings', 'Welcome visitor'],
      'en',
      'nl',
      expect.objectContaining({ customPrompt: undefined }),
    )
    expect(translateTextsMock).toHaveBeenNthCalledWith(
      3,
      ['Greetings'],
      'en',
      'nl',
      expect.objectContaining({ customPrompt: undefined }),
    )
    expect(translateTextsMock).toHaveBeenNthCalledWith(
      4,
      ['Welcome visitor'],
      'en',
      'nl',
      expect.objectContaining({ customPrompt: undefined }),
    )

    expect(payloadMock.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          settings: {
            hero: {
              headline: 'Hallo daar',
              nested: {
                description: 'Welkom bezoeker',
              },
            },
          },
        }),
        locale: 'nl',
      }),
    )

    expect(events).toEqual([
      { type: 'progress', completed: 2, locale: 'nl', total: 2 },
      { type: 'applied', locale: 'nl' },
      { type: 'done' },
    ])
  })

  it('surfaces an error if per-item fallback also fails', async () => {
    const baseDoc = {
      id: '1',
      settings: {
        hero: {
          headline: 'Greetings',
          nested: { description: 'Welcome visitor' },
        },
      },
    }

    const payloadMock = {
      findByID: vi.fn<Payload['findByID']>().mockResolvedValue(baseDoc),
      logger: {
        error: vi.fn(),
        info: vi.fn(),
      },
      update: vi.fn<Payload['update']>(async (args) => recordSave(args)),
    } satisfies Partial<Payload>

    translateTextsMock
      .mockRejectedValueOnce(new Error('Batch failure'))
      .mockRejectedValueOnce(new Error('Chunk failure'))
      .mockRejectedValueOnce(new Error('Single failure'))

    const request: TranslateRequestPayload = {
      id: '1',
      collection: 'pages',
      from: 'en',
      locales: [
        {
          chunks: [
            [
              {
                lexical: false,
                path: 'settings.hero.headline',
                text: 'Greetings',
              },
              {
                lexical: false,
                path: 'settings.hero.nested.description',
                text: 'Welcome visitor',
              },
            ],
          ],
          code: 'nl',
        },
      ],
    }

    const events: unknown[] = []
    for await (const event of streamTranslations(payloadMock as Payload, request)) {
      events.push(event)
    }

    expect(translateTextsMock).toHaveBeenCalledTimes(3)
    expect(translateTextsMock).toHaveBeenNthCalledWith(
      1,
      ['Greetings', 'Welcome visitor'],
      'en',
      'nl',
      expect.objectContaining({ customPrompt: undefined }),
    )
    expect(translateTextsMock).toHaveBeenNthCalledWith(
      2,
      ['Greetings', 'Welcome visitor'],
      'en',
      'nl',
      expect.objectContaining({ customPrompt: undefined }),
    )
    expect(translateTextsMock).toHaveBeenNthCalledWith(
      3,
      ['Greetings'],
      'en',
      'nl',
      expect.objectContaining({ customPrompt: undefined }),
    )

    expect(events).toEqual([{ type: 'error', message: 'Single failure' }])

    expect(payloadMock.logger?.error).toHaveBeenCalledWith(
      '[AI Translate] OpenAI translation failed for pages#1 (nl): Single failure',
    )
  })

  it('translates deeply nested blocks without dropping values', async () => {
    const baseDoc = {
      id: '1',
      layout: [
        {
          blockType: 'accordion',
          items: [
            {
              title: 'Top level heading',
              nestedBlocks: [
                {
                  blockType: 'callToAction',
                  label: 'Call to action',
                  stats: [
                    {
                      blockType: 'stat',
                      description: 'Nested statistic description',
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    }

    const payloadMock = {
      findByID: vi.fn<Payload['findByID']>().mockImplementation(async ({ locale }) => {
        if (locale === 'en') {
          return baseDoc
        }

        return { id: '1', ...savedFor(locale) }
      }),
      logger: {
        error: vi.fn(),
        info: vi.fn(),
      },
      update: vi.fn<Payload['update']>(async (args) => recordSave(args)),
    } satisfies Partial<Payload>

    translateTextsMock.mockResolvedValueOnce([
      'Bovenste kop',
      'Oproep tot actie',
      'Geneste statistiekbeschrijving',
    ])

    const request: TranslateRequestPayload = {
      id: '1',
      collection: 'pages',
      from: 'en',
      locales: [
        {
          chunks: [
            [
              {
                lexical: false,
                path: 'layout.0.items.0.title',
                text: 'Top level heading',
              },
              {
                lexical: false,
                path: 'layout.0.items.0.nestedBlocks.0.label',
                text: 'Call to action',
              },
              {
                lexical: false,
                path: 'layout.0.items.0.nestedBlocks.0.stats.0.description',
                text: 'Nested statistic description',
              },
            ],
          ],
          code: 'nl',
        },
      ],
    }

    const events: unknown[] = []
    for await (const event of streamTranslations(payloadMock as Payload, request)) {
      events.push(event)
    }

    expect(translateTextsMock).toHaveBeenCalledWith(
      ['Top level heading', 'Call to action', 'Nested statistic description'],
      'en',
      'nl',
      expect.objectContaining({ customPrompt: undefined }),
    )

    expect(payloadMock.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          layout: [
            {
              blockType: 'accordion',
              items: [
                {
                  title: 'Bovenste kop',
                  nestedBlocks: [
                    {
                      blockType: 'callToAction',
                      label: 'Oproep tot actie',
                      stats: [
                        {
                          blockType: 'stat',
                          description: 'Geneste statistiekbeschrijving',
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        }),
      }),
    )

    expect(events).toEqual([
      { type: 'progress', completed: 3, locale: 'nl', total: 3 },
      { type: 'applied', locale: 'nl' },
      { type: 'done' },
    ])
  })

  it('emits an error event when translator output length mismatches the chunk', async () => {
    const baseDoc = {
      id: '1',
      title: 'Hello world',
    }

    const payloadMock = {
      findByID: vi.fn<Payload['findByID']>().mockImplementation(async ({ locale }) => {
        if (locale === 'en') {
          return baseDoc
        }

        return { id: '1', ...savedFor(locale) }
      }),
      logger: {
        error: vi.fn(),
        info: vi.fn(),
      },
      update: vi.fn<Payload['update']>(async (args) => recordSave(args)),
    } satisfies Partial<Payload>

    translateTextsMock.mockResolvedValueOnce([])

    const request: TranslateRequestPayload = {
      id: '1',
      collection: 'pages',
      from: 'en',
      locales: [
        {
          chunks: [
            [
              {
                lexical: false,
                path: 'title',
                text: 'Hello world',
              },
            ],
          ],
          code: 'nl',
        },
      ],
    }

    const events: unknown[] = []
    for await (const event of streamTranslations(payloadMock as Payload, request)) {
      events.push(event)
    }

    expect(events).toEqual([
      {
        type: 'error',
        message: 'Translator mismatch: expected 1, received 0',
      },
    ])
    expect(payloadMock.update).not.toHaveBeenCalled()
    expect(payloadMock.logger?.error).toHaveBeenCalledWith(
      '[AI Translate] Translation mismatch for pages#1 (nl).',
    )
  })

  it('translates lexical rich text fields while preserving structure', async () => {
    const baseDoc = structuredClone(tabbedBlockDocument)
    const lexicalValue = baseDoc.components[1]?.tab2?.fieldInTab2
    const serialized = serializeLexicalValue(lexicalValue)
    expect(serialized).not.toBeNull()

    const segments = splitLexicalText(serialized!.text, MAX_CHARS_PER_CHUNK)
    expect(segments.length).toBeGreaterThan(1)

    const replacePlaceholders = (input: string) =>
      input.replace(
        /\[\[LEX-(\d+)\]\]([\s\S]*?)\[\[\/LEX-\1\]\]/g,
        (_match, index) => `[[LEX-${index}]]Vertaling ${index}[[/LEX-${index}]]`,
      )

    const translatedSegments = segments.map((segment) => replacePlaceholders(segment))
    const translation = replacePlaceholders(serialized!.text)

    const payloadMock = {
      findByID: vi.fn<Payload['findByID']>().mockImplementation(async ({ locale }) => {
        if (locale === 'en') {
          return baseDoc
        }

        return { id: baseDoc.id, ...savedFor(locale) }
      }),
      logger: {
        error: vi.fn(),
        info: vi.fn(),
      },
      update: vi.fn<Payload['update']>(async (args) => recordSave(args)),
    } satisfies Partial<Payload>

    let callIndex = 0
    translateTextsMock.mockImplementation(async (inputs) => {
      expect(inputs).toHaveLength(1)
      const segment = inputs[0]
      expect(segment).toBe(segments[callIndex])
      const output = translatedSegments[callIndex]
      callIndex += 1
      return [output]
    })

    const request: TranslateRequestPayload = {
      id: baseDoc.id,
      collection: 'posts',
      from: 'en',
      locales: [
        {
          chunks: [
            [
              {
                lexical: true,
                path: 'components.1.tab2.fieldInTab2',
                text: serialized!.text,
              },
            ],
          ],
          code: 'nl',
        },
      ],
    }

    const events: unknown[] = []
    for await (const event of streamTranslations(payloadMock as Payload, request)) {
      events.push(event)
    }

    expect(events).toContainEqual({ type: 'applied', locale: 'nl' })
    expect(events).toContainEqual({ type: 'done' })
    expect(payloadMock.update).toHaveBeenCalledTimes(1)
    expect(callIndex).toBe(segments.length)

    const saved = payloadMock.update.mock.calls[0][0]
    const savedValue = serializeLexicalValue(saved.data?.components?.[1]?.tab2?.fieldInTab2)
    expect(savedValue?.text).toEqual(translation)
  })

  it('publishes only the translated locale when the source document is published', async () => {
    const baseDoc = {
      id: '1',
      _status: 'published',
      title: 'Hello world',
    }

    const payloadMock = {
      findByID: vi.fn<Payload['findByID']>().mockImplementation(async ({ locale }) => {
        if (locale === 'en') {
          return structuredClone(baseDoc)
        }

        return { id: '1', ...savedFor(locale) }
      }),
      logger: {
        error: vi.fn(),
        info: vi.fn(),
      },
      update: vi.fn<Payload['update']>(async (args) => recordSave(args)),
    } satisfies Partial<Payload>

    translateTextsMock.mockResolvedValueOnce(['Hallo wereld'])

    const request: TranslateRequestPayload = {
      id: '1',
      collection: 'pages',
      from: 'en',
      locales: [
        {
          chunks: [[{ lexical: false, path: 'title', text: 'Hello world' }]],
          code: 'nl',
        },
      ],
    }

    for await (const event of streamTranslations(payloadMock as Payload, request)) {
      if (event.type === 'error') {
        throw new Error(event.message)
      }
    }

    expect(payloadMock.update).toHaveBeenCalledTimes(1)
    expect(payloadMock.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ _status: 'published', title: 'Hallo wereld' }),
        locale: 'nl',
        publishSpecificLocale: 'nl',
      }),
    )
    expect(payloadMock.update.mock.calls[0][0]).not.toHaveProperty('draft')
  })

  it('saves translations as drafts when the source document is a draft', async () => {
    const baseDoc = {
      id: '1',
      _status: 'draft',
      title: 'Hello world',
    }

    const payloadMock = {
      findByID: vi.fn<Payload['findByID']>().mockImplementation(async ({ locale }) => {
        if (locale === 'en') {
          return structuredClone(baseDoc)
        }

        return { id: '1', ...savedFor(locale) }
      }),
      logger: {
        error: vi.fn(),
        info: vi.fn(),
      },
      update: vi.fn<Payload['update']>(async (args) => recordSave(args)),
    } satisfies Partial<Payload>

    translateTextsMock.mockResolvedValueOnce(['Hallo wereld'])

    const request: TranslateRequestPayload = {
      id: '1',
      collection: 'pages',
      from: 'en',
      locales: [
        {
          chunks: [[{ lexical: false, path: 'title', text: 'Hello world' }]],
          code: 'nl',
        },
      ],
    }

    for await (const event of streamTranslations(payloadMock as Payload, request)) {
      if (event.type === 'error') {
        throw new Error(event.message)
      }
    }

    expect(payloadMock.update).toHaveBeenCalledTimes(1)
    expect(payloadMock.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ title: 'Hallo wereld' }),
        draft: true,
        locale: 'nl',
      }),
    )
    expect(payloadMock.update.mock.calls[0][0]).not.toHaveProperty('publishSpecificLocale')
    expect(payloadMock.update.mock.calls[0][0]?.data).not.toHaveProperty('_status')
  })

  it('tags plugin saves with a contentOps context marker', async () => {
    const baseDoc = { id: '1', title: 'Hello world' }

    const payloadMock = {
      findByID: vi.fn<Payload['findByID']>().mockImplementation(async ({ locale }) => {
        if (locale === 'en') {
          return baseDoc
        }

        return { id: '1', ...savedFor(locale) }
      }),
      logger: {
        error: vi.fn(),
        info: vi.fn(),
      },
      update: vi.fn<Payload['update']>(async (args) => recordSave(args)),
    } satisfies Partial<Payload>

    translateTextsMock.mockResolvedValueOnce(['Hallo wereld'])

    const request: TranslateRequestPayload = {
      id: '1',
      collection: 'pages',
      from: 'en',
      locales: [
        {
          chunks: [[{ lexical: false, path: 'title', text: 'Hello world' }]],
          code: 'nl',
        },
      ],
    }

    for await (const event of streamTranslations(payloadMock as Payload, request)) {
      if (event.type === 'error') {
        throw new Error(event.message)
      }
    }

    expect(payloadMock.update).toHaveBeenCalledWith(
      expect.objectContaining({
        context: {
          contentOps: {
            operation: 'translationSync',
            sourceLocale: 'en',
            targetLocale: 'nl',
          },
        },
      }),
    )
  })

  it.each(['unreadable', 'fourth-field'])(
    'does not record a successful sync after %s verification failure',
    async (failure) => {
      const paths = ['subtitle', 'body', 'summary', 'title']
      const baseDoc = {
        id: '1',
        _status: 'published',
        ...Object.fromEntries(paths.map((path) => [path, `English ${path}`])),
      }
      configureTranslationState(
        [
          {
            config: {
              slug: 'pages',
              fields: paths.map((name) => ({ name, type: 'text', localized: true })),
            },
          },
        ],
        [],
        { defaultLocale: 'en', locales: ['en', 'nl'] },
      )
      let saved = false
      const payloadMock = {
        findByID: vi.fn(async ({ locale }) => {
          if (locale === 'en') return baseDoc
          if (!saved) return { id: '1' }
          if (failure === 'unreadable') throw new Error('Read unavailable')
          return {
            id: '1',
            ...Object.fromEntries(paths.slice(0, 3).map((path) => [path, `NL ${path}`])),
          }
        }),
        find: vi.fn(async () => ({ docs: [] })),
        create: vi.fn(),
        logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
        update: vi.fn(async () => {
          saved = true
          return {}
        }),
      }
      translateTextsMock.mockResolvedValue(paths.map((path) => `NL ${path}`))
      const events = []
      for await (const event of streamTranslations(payloadMock as unknown as Payload, {
        collection: 'pages',
        id: '1',
        from: 'en',
        locales: [
          {
            code: 'nl',
            chunks: [paths.map((path) => ({ lexical: false, path, text: `English ${path}` }))],
          },
        ],
      }))
        events.push(event)
      expect(events).toContainEqual(
        expect.objectContaining({
          type: 'error',
          message: expect.stringContaining(
            failure === 'unreadable' ? 'Could not verify' : 'did not persist at "title"',
          ),
        }),
      )
      expect(events.some((event) => event.type === 'applied')).toBe(false)
      expect(payloadMock.create).not.toHaveBeenCalled()
    },
  )

  it('emits an error when a saved translation does not persist in the target locale', async () => {
    const baseDoc = { id: '1', title: 'Hello world' }

    const payloadMock = {
      // The target locale keeps returning an empty document even after the
      // save — the signature of a rerouted locale (e.g. a consumer hook
      // passing req with another locale into a nested operation).
      findByID: vi.fn<Payload['findByID']>().mockImplementation(async ({ locale }) => {
        if (locale === 'en') {
          return baseDoc
        }

        return { id: '1' }
      }),
      logger: {
        error: vi.fn(),
        info: vi.fn(),
      },
      update: vi.fn<Payload['update']>(async (args) => args),
    } satisfies Partial<Payload>

    translateTextsMock.mockResolvedValueOnce(['Hallo wereld'])

    const request: TranslateRequestPayload = {
      id: '1',
      collection: 'pages',
      from: 'en',
      locales: [
        {
          chunks: [[{ lexical: false, path: 'title', text: 'Hello world' }]],
          code: 'nl',
        },
      ],
    }

    const events: unknown[] = []
    for await (const event of streamTranslations(payloadMock as Payload, request)) {
      events.push(event)
    }

    expect(payloadMock.update).toHaveBeenCalledTimes(1)
    expect(events).toContainEqual(
      expect.objectContaining({
        message: expect.stringContaining('did not persist at "title"'),
        type: 'error',
      }),
    )
    expect(events).not.toContainEqual(expect.objectContaining({ type: 'applied' }))
  })
})
