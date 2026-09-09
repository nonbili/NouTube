type NavigationLink = { href: string; target?: string }

/* Mobile YouTube's Home logo is a button, not an anchor. It must be handed
 * over before its router tears down the watch player, just like a normal link. */
export function findSplitLink(event: Pick<MouseEvent, 'composedPath' | 'target'>): NavigationLink | null {
  const path = typeof event.composedPath === 'function' ? event.composedPath() : []
  const target = event.target as Element | null
  const elements = [...path, target?.closest?.('a[href], ytm-home-logo')]
  for (const node of elements) {
    const element = node as Element | undefined
    if (element?.tagName === 'A') {
      const anchor = element as HTMLAnchorElement
      const href = anchor.getAttribute('href')
      if (href) return { href, target: anchor.target }
    }
    if (element?.tagName === 'YTM-HOME-LOGO') {
      return { href: '/' }
    }
  }
  return null
}
