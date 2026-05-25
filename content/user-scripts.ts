import { getEnabledUserScripts, type UserStylesSnapshot } from '../lib/user-styles'
import { noutubeUserStylesEvent } from './noutube'

const ranIds = new Set<string>()

function runUserScripts(snapshot?: UserStylesSnapshot) {
  const userStyles = snapshot || window.NouTube?.getUserStyles?.()
  if (!userStyles) {
    return
  }
  for (const script of getEnabledUserScripts(userStyles)) {
    if (ranIds.has(script.id)) {
      continue
    }
    ranIds.add(script.id)
    try {
      new Function(script.js).call(window)
    } catch (error) {
      console.error('[NouTube user script] ' + script.name, error)
    }
  }
}

export function initUserScripts() {
  runUserScripts()
  window.addEventListener(noutubeUserStylesEvent, (e) => runUserScripts((e as CustomEvent).detail))
}
