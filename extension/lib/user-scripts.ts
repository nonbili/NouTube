import { browser } from 'wxt/browser'
import { buildUserScriptExecutionSource, getEnabledUserScripts, type UserStylesSnapshot } from '@/lib/user-styles'
import { YOUTUBE_MATCHES } from './hosts'

const idPrefix = 'noutube-user-script-'

/*
 * The shells hand user scripts to a channel that the page CSP does not police
 * (Android's evaluateJavascript, Electron's executeJavaScript). An extension has
 * exactly one equivalent: the userScripts API. Chrome keeps it behind a
 * per-extension switch the user has to flip, and merely touching the namespace
 * throws until they do, hence the guard.
 */
interface RegisteredUserScript {
  id: string
  matches: string[]
  js: Array<{ code: string }>
  runAt: 'document_start' | 'document_end' | 'document_idle'
  world: 'MAIN' | 'USER_SCRIPT'
}

interface UserScriptsApi {
  configureWorld?: (options: { messaging?: boolean; csp?: string }) => Promise<void>
  getScripts: () => Promise<RegisteredUserScript[]>
  register: (scripts: RegisteredUserScript[]) => Promise<void>
  unregister: (filter: { ids: string[] }) => Promise<void>
}

export function getUserScriptsApi(): UserScriptsApi | undefined {
  try {
    return (browser as any).userScripts as UserScriptsApi | undefined
  } catch {
    return undefined
  }
}

export const userScriptsAvailable = () => Boolean(getUserScriptsApi())

export async function syncUserScripts(userStyles: UserStylesSnapshot) {
  const api = getUserScriptsApi()
  if (!api) {
    return false
  }

  try {
    // Chrome requires a configured world before the first registration.
    await api.configureWorld?.({ messaging: false })
  } catch {}

  try {
    const existing = await api.getScripts()
    const ids = existing.map((script) => script.id).filter((id) => id.startsWith(idPrefix))
    if (ids.length) {
      await api.unregister({ ids })
    }

    const scripts = getEnabledUserScripts(userStyles)
    if (!scripts.length) {
      return true
    }

    await api.register(
      scripts.map((script) => ({
        id: idPrefix + script.id,
        matches: YOUTUBE_MATCHES,
        // One registration per script, so a syntax error in one cannot keep the
        // others from being parsed.
        js: [{ code: buildUserScriptExecutionSource(script) }],
        runAt: script.runAt === 'document-start' ? 'document_start' : 'document_end',
        world: 'MAIN',
      })),
    )
    return true
  } catch (error) {
    console.error('NouTube user scripts:', error)
    return false
  }
}
