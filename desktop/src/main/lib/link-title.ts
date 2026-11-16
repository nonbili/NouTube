export async function resolveVideoLinkTitle(
  webContents: { executeJavaScript: (script: string) => Promise<unknown> },
  url: string,
  fallback: string,
): Promise<string> {
  try {
    const title = await webContents.executeJavaScript(
      `window.NouTube?.getVideoLinkTitle?.(${JSON.stringify(url)})`,
    )
    if (typeof title === 'string' && title.trim()) return title
  } catch {
    // The page may have navigated away or the content bundle may be unavailable.
  }
  return fallback
}
