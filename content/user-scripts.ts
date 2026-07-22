import {
  getEnabledBuiltinUserScriptIds,
  getEnabledUserScripts,
  type BuiltinUserScriptId,
  type UserStylesSnapshot,
} from '../lib/user-styles'
import { noutubeUserStylesEvent } from './noutube'

const ranIds = new Set<string>()
const ranBuiltinIds = new Set<BuiltinUserScriptId>()

function installEncodedAuthorNameFix() {
  const fixEncodedAuthorNames = () => {
    const player = document.querySelector<any>('#movie_player')
    const author = player?.getPlayerResponse?.()?.videoDetails?.author
    if (!author) {
      return
    }

    document
      .querySelectorAll(
        'ytm-slim-video-information-renderer .slim-video-information-channel-name .ytAttributedStringHost, ' +
          'ytm-slim-owner-renderer .ytAttributedStringHost',
      )
      .forEach((label) => {
        if (!/%[0-9a-f]{2}/i.test(label.textContent || '')) {
          return
        }

        const parts = label.querySelectorAll(':scope > span')
        const name = parts.length > 1 && parts[0].textContent === '@' ? parts[parts.length - 1] : label
        const text = name === label ? '@' + author : author
        if (name.textContent !== text) {
          name.textContent = text
        }
      })
  }

  new MutationObserver(fixEncodedAuthorNames).observe(document.documentElement, {
    childList: true,
    subtree: true,
  })
  fixEncodedAuthorNames()
}

const builtinInstallers: Record<BuiltinUserScriptId, () => void> = {
  'fix-encoded-author-names': installEncodedAuthorNameFix,
}

function runBuiltinUserScripts(snapshot: UserStylesSnapshot) {
  for (const id of getEnabledBuiltinUserScriptIds(snapshot)) {
    if (ranBuiltinIds.has(id)) {
      continue
    }
    try {
      builtinInstallers[id]()
      ranBuiltinIds.add(id)
    } catch (error) {
      console.error('[NouTube built-in script] ' + id, error)
    }
  }
}

function runUserScripts(snapshot?: UserStylesSnapshot) {
  const userStyles = snapshot || window.NouTube?.getUserStyles?.()
  if (!userStyles) {
    return
  }
  runBuiltinUserScripts(userStyles)
  for (const script of getEnabledUserScripts(userStyles)) {
    if (ranIds.has(script.id)) {
      continue
    }
    try {
      new Function(script.js).call(window)
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
