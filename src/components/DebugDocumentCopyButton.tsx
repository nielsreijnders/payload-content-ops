'use client'

import { toast, useDocumentForm, useDocumentInfo, useForm } from '@payloadcms/ui'
import { Clipboard } from 'lucide-react'
import * as React from 'react'

import type {
  AutoTranslateButtonProps,
  FormApi,
  LocalizedFieldPatternsInput,
} from './auto-translate-button/hooks/types.js'

import { chunkItems } from '../utils/localizedFields.js'
import { useLocalizedFieldPatterns } from './auto-translate-button/hooks/useLocalizedFieldPatterns.js'
import { buildTranslatableItems } from './auto-translate-button/utils/buildTranslatableItems.js'
import { IconTooltipButton } from './shared/IconTooltipButton.js'

export function DebugDocumentCopyButton(props: AutoTranslateButtonProps) {
  const { id, collectionSlug, docConfig, globalSlug } = useDocumentInfo()

  const form = useForm()

  const documentForm = useDocumentForm()
  const [busy, setBusy] = React.useState(false)

  const fieldPatterns = useLocalizedFieldPatterns(
    (docConfig as LocalizedFieldPatternsInput)?.fields,
    props.fieldPatterns,
  )

  const formApi = (documentForm ?? form) as FormApi | undefined

  const handleCopy = React.useCallback(async () => {
    if (!formApi?.getData) {
      toast.error('Form state is not available.')
      return
    }

    if (!collectionSlug && !globalSlug) {
      toast.error('Localization settings are missing.')
      return
    }

    if (!navigator?.clipboard?.writeText) {
      toast.error('Clipboard API is not available in this browser.')
      return
    }

    try {
      setBusy(true)

      const data = formApi.getData()
      const items = buildTranslatableItems(data, fieldPatterns)
      const chunked = chunkItems(items)

      const defaultLocale = props.defaultLocale
      // Form data may be an unsaved draft. Include the server's comparison
      // against the saved source and last sync instead of guessing from it.
      let syncStatus: unknown = null
      if (globalSlug || id != null) {
        try {
          const response = await fetch('/api/ai-sync-status/document', {
            body: JSON.stringify({ id, collection: collectionSlug, global: globalSlug }),
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            method: 'POST',
            signal: AbortSignal.timeout(10000),
          })
          syncStatus = response.ok
            ? await response.json()
            : { error: `Status request failed (${response.status}).` }
        } catch {
          syncStatus = { error: 'Could not load saved translation status.' }
        }
      }

      const payload = {
        chunks: chunked,
        documentData: data,
        meta: {
          collectionSlug,
          defaultLocale,
          documentId: id ?? null,
          fieldPatterns,
          globalSlug,
          locales: props.locales,
        },
        syncStatus,
        translatableItems: items,
      }

      const serialized = JSON.stringify(payload, null, 2)
      await navigator.clipboard.writeText(serialized)

      toast.success('Document translation debug info copied to clipboard.')
    } catch (error) {
      console.error('Failed to copy translation debug info', error)
      toast.error('Failed to copy translation debug info.')
    } finally {
      setBusy(false)
    }
  }, [collectionSlug, fieldPatterns, formApi, globalSlug, id, props.defaultLocale, props.locales])

  return (
    <IconTooltipButton
      disabled={busy}
      icon={<Clipboard size={18} strokeWidth={1.5} />}
      label="Copy translation debug info"
      onClick={handleCopy}
    />
  )
}
