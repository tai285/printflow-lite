import { useEffect } from 'react'

const SUFFIX = 'PrintFlow Lite'

/** Sets the browser tab title (and what search engines show) for a page. */
export function useDocumentTitle(title?: string) {
  useEffect(() => {
    document.title = title
      ? `${title} · ${SUFFIX}`
      : `${SUFFIX}: quotes and orders for print shops`
  }, [title])
}
