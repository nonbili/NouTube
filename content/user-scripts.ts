import { getEnabledUserScripts, type UserStylesSnapshot } from '../lib/user-styles'
import { noutubeUserStylesEvent } from './noutube'

const ranIds = new Set<string>()

// YouTube serves `require-trusted-types-for 'script'`, which makes the Function
// constructor throw on a plain string. It sets no `trusted-types` directive, so
// creating our own policy is allowed and turns the script body into a value the
// constructor accepts.
let compile: ((js: string) => string) | null | undefined

function toTrustedScript(js: string) {
  const trustedTypes = (window as any).trustedTypes
  if (!trustedTypes?.createPolicy) {
    return js
  }
  if (compile === undefined) {
    try {
      const policy = trustedTypes.createPolicy('_nou_user_scripts', { createScript: (source: string) => source })
      compile = (source: string) => policy.createScript(source)
    } catch (error) {
      console.error('[NouTube user script policy]', error)
      compile = null
    }
  }
  return compile ? compile(js) : js
}

function runUserScripts(snapshot?: UserStylesSnapshot) {
  const userStyles = snapshot || window.NouTube?.getUserStyles?.()
  if (!userStyles) {
    return
  }
  for (const script of getEnabledUserScripts(userStyles)) {
    if (ranIds.has(script.id)) {
      continue
    }
    try {
      new Function(toTrustedScript(script.js)).call(window)
      ranIds.add(script.id)
    } catch (error) {
      console.error('[NouTube user script] ' + script.name, error)
    }
  }
}

export function initUserScripts() {
  runUserScripts()
  window.addEventListener(noutubeUserStylesEvent, (e) => runUserScripts((e as CustomEvent).detail))
}
