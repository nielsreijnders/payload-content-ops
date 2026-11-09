import { extractPlainText, getValueAtPath } from '../utils/localizedFields.js'

export type MissingTranslation = { expected: string; path: string }

const normalizeComparable = (value: unknown): null | string => {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed.length ? trimmed : null
  }

  if (value && typeof value === 'object') {
    const text = extractPlainText(value)
    const trimmed = text?.trim()
    return trimmed?.length ? trimmed : null
  }

  return null
}

/**
 * Post-save integrity check: confirms translated values actually landed in
 * the target locale. A structurally valid save can still reroute localized
 * data into another locale — e.g. when a consumer collection hook passes
 * `req` into a nested local operation with a different `locale` (payload
 * mutates `req.locale` for the rest of the update), or when a core locale
 * merge regresses. That failure mode is silent: the operation succeeds while
 * the target locale stays empty.
 *
 * Only *missing* values are fatal. Textual differences are tolerated so
 * consumer hooks may legitimately normalize or transform saved text.
 */
export function findMissingTranslation({
  expectedData,
  paths,
  persistedDoc,
}: {
  expectedData: unknown
  paths: string[]
  persistedDoc: Record<string, unknown>
}): MissingTranslation | null {
  for (const path of new Set(paths)) {
    const expected = normalizeComparable(getValueAtPath(expectedData, path))
    if (!expected) {
      continue
    }

    const actual = normalizeComparable(getValueAtPath(persistedDoc, path))
    if (!actual) {
      return { expected, path }
    }
  }

  return null
}
