export const USER_STYLES_SCHEMA_VERSION = 5

export const builtinUserStyleIds = [
  'hide-mix-playlist',
  'hide-shorts-navbar',
  'hide-community-posts',
  'hide-ask-button',
  'hide-home-feed',
  'hide-related-videos',
  'hide-end-screens',
] as const

export type BuiltinUserStyleId = (typeof builtinUserStyleIds)[number]

export interface BuiltinUserStyleState {
  enabled: boolean
}

export interface CustomUserStyle {
  id: string
  name: string
  enabled: boolean
  css: string
}

export type UserScriptRunAt = 'document-start' | 'document-end'

export interface CustomUserScript {
  id: string
  name: string
  enabled: boolean
  pinToHeader: boolean
  // `document-start` runs before the page builds its DOM, so a script can patch
  // fetch/XHR or other globals before YouTube uses them; `document-end` is the
  // default and waits for the DOM like a user script manager does.
  runAt: UserScriptRunAt
  js: string
}

export interface UserStylesSnapshot {
  schemaVersion: number
  builtins: Record<BuiltinUserStyleId, BuiltinUserStyleState>
  customStyles: CustomUserStyle[]
  customScripts: CustomUserScript[]
}

export interface BuiltinUserStyleDefinition {
  id: BuiltinUserStyleId
  labelKey: string
  css: string
}

const css = (raw: ArrayLike<string>, ...values: any[]) => String.raw({ raw }, ...values)
const alphabet = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'

const createId = (size = 6) => {
  let value = ''
  for (let index = 0; index < size; index += 1) {
    value += alphabet[Math.floor(Math.random() * alphabet.length)]
  }
  return value
}

export const builtinUserStyleDefinitions: BuiltinUserStyleDefinition[] = [
  {
    id: 'hide-mix-playlist',
    labelKey: 'settings.userStyles.builtin.hideMixPlaylist.label',
    css: css`
      ytm-compact-radio-renderer:has(yt-collections-stack),
      ytm-compact-playlist-renderer:has(yt-collections-stack),
      ytm-rich-item-renderer:has(yt-collections-stack) {
        display: none !important;
      }
    `,
  },
  {
    id: 'hide-shorts-navbar',
    labelKey: 'settings.userStyles.builtin.hideShortsInNavbar.label',
    css: css`
      yt-tab-shape[tab-title='Shorts'],
      ytd-guide-entry-renderer:has(a[href^='/shorts']),
      ytd-mini-guide-entry-renderer:has(a[href^='/shorts']),
      ytm-pivot-bar-item-renderer:has(.pivot-shorts) {
        display: none !important;
      }
    `,
  },
  {
    id: 'hide-community-posts',
    labelKey: 'settings.userStyles.builtin.hideCommunityPosts.label',
    css: css`
      ytd-rich-section-renderer:has(ytd-post-renderer),
      ytd-post-renderer,
      ytd-backstage-post-thread-renderer,
      ytm-rich-section-renderer:has(ytm-post-renderer),
      ytm-post-renderer,
      ytm-backstage-post-thread-renderer {
        display: none !important;
      }
    `,
  },
  {
    id: 'hide-ask-button',
    labelKey: 'settings.userStyles.builtin.hideAskButton.label',
    css: css`
      .you-chat-entrypoint-button,
      yt-button-view-model:has(> .you-chat-entrypoint-button) {
        display: none !important;
      }
    `,
  },
  {
    id: 'hide-home-feed',
    labelKey: 'settings.userStyles.builtin.hideHomeFeed.label',
    // m.youtube.com has no page-subtype attribute; the home tab is identified by its
    // browse endpoint (FEwhat_to_watch) on the tab-content wrapper.
    css: css`
      ytd-browse[page-subtype='home'] #contents,
      ytm-browse [tab-identifier='FEwhat_to_watch'] ytm-rich-grid-renderer {
        display: none !important;
      }
    `,
  },
  {
    id: 'hide-related-videos',
    labelKey: 'settings.userStyles.builtin.hideRelatedVideos.label',
    css: css`
      #related,
      ytd-watch-next-secondary-results-renderer,
      ytm-watch-next-secondary-results-renderer,
      ytm-item-section-renderer[section-identifier='related-items'] {
        display: none !important;
      }
    `,
  },
  {
    id: 'hide-end-screens',
    labelKey: 'settings.userStyles.builtin.hideEndScreens.label',
    css: css`
      .ytp-ce-element,
      .ytp-endscreen-content,
      .ytp-suggested-video-overlay,
      .ytp-pause-overlay,
      .ytp-pause-overlay-container {
        display: none !important;
      }
    `,
  },
]

export const builtinUserStyleDefinitionById = builtinUserStyleDefinitions.reduce(
  (acc, definition) => {
    acc[definition.id] = definition
    return acc
  },
  {} as Record<BuiltinUserStyleId, BuiltinUserStyleDefinition>,
)

export const createDefaultBuiltinUserStyles = (): Record<BuiltinUserStyleId, BuiltinUserStyleState> => ({
  'hide-mix-playlist': { enabled: false },
  'hide-shorts-navbar': { enabled: false },
  'hide-community-posts': { enabled: false },
  'hide-ask-button': { enabled: false },
  'hide-home-feed': { enabled: false },
  'hide-related-videos': { enabled: false },
  'hide-end-screens': { enabled: false },
})

export const createDefaultUserStylesSnapshot = (): UserStylesSnapshot => ({
  schemaVersion: USER_STYLES_SCHEMA_VERSION,
  builtins: createDefaultBuiltinUserStyles(),
  customStyles: [],
  customScripts: [],
})

export const getEnabledUserStyleCss = (host: string, snapshot?: UserStylesSnapshot) => {
  const userStyles = snapshot || createDefaultUserStylesSnapshot()
  const builtinCss = builtinUserStyleDefinitions
    .filter((definition) => userStyles.builtins[definition.id]?.enabled !== false)
    .map((definition) => definition.css.trim())
    .filter(Boolean)

  const customCss = (userStyles.customStyles || [])
    .filter((style) => style.enabled)
    .filter((style) => style.css.trim())
    .map((style) => style.css.trim())
    .filter(Boolean)

  return [...builtinCss, ...customCss].join('\n\n')
}

export const getEnabledUserScripts = (snapshot?: UserStylesSnapshot) => {
  const userStyles = snapshot || createDefaultUserStylesSnapshot()

  return (userStyles.customScripts || [])
    .filter((script) => script.enabled)
    .filter((script) => script.js.trim())
    .map((script) => ({
      ...script,
      js: script.js.trim(),
    }))
}

/*
 * User scripts cannot be compiled from inside the page: YouTube serves
 * `require-trusted-types-for 'script'`, and this WebView rejects even a
 * TrustedScript passed to the Function constructor. The embedder channels
 * (Android evaluateJavascript on page start, Electron executeJavaScript) are
 * not subject to the page CSP, so the sources are handed to that channel
 * instead of being evaluated by the content script.
 */
const userScriptsState = `(window.__nouUserScripts || (window.__nouUserScripts = { ran: {}, gen: 0 }))`

/*
 * Bumped before a fresh set of sources is injected. A document-end script
 * scheduled during page load holds the source it was injected with, so if the
 * user disables or edits it before DOMContentLoaded fires, that stale callback
 * has to stand down and let the replacement (if any) run instead.
 */
export const userScriptsInvalidationSource = `;${userScriptsState}.gen++;`

/*
 * One string per script, never a concatenation: a syntax error is raised while
 * the whole injected unit is parsed, before any try/catch can run, so sharing a
 * unit would let one malformed script take down its neighbours — and the
 * content bundle with them.
 */
export const buildUserScriptSources = (snapshot?: UserStylesSnapshot) =>
  getEnabledUserScripts(snapshot).map(
    (script) => `;(function () {
  var state = ${userScriptsState};
  var id = ${JSON.stringify(script.id)};
  var gen = state.gen;
  if (state.ran[id]) return;
  var run = function () {
    // Superseded while the document was still loading, or already run.
    if (state.gen !== gen || state.ran[id]) return;
    state.ran[id] = true;
    try {
${script.js}
    } catch (e) {
      console.error(${JSON.stringify('[NouTube user script] ' + script.name)}, e)
    }
  };
  if (${script.runAt === 'document-start' ? 'false' : 'true'} && document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, { once: true });
  } else {
    run();
  }
})();`,
  )

export const buildUserScriptExecutionSource = (script: Pick<CustomUserScript, 'name' | 'js'>) => {
  return `(() => { try {\n${script.js}\n} catch (e) { console.error(${JSON.stringify('[NouTube user script run] ' + script.name)}, e) } })();`
}

const normalizeCustomUserStyle = (
  style: Partial<CustomUserStyle> | null | undefined,
  index: number,
): CustomUserStyle | null => {
  if (!style) {
    return null
  }

  const css = typeof style.css === 'string' ? style.css.replace(/\s+$/, '') : ''
  if (!css.trim()) {
    return null
  }

  const name = typeof style.name === 'string' && style.name.trim() ? style.name.trim() : `Style ${index + 1}`

  return {
    id: typeof style.id === 'string' && style.id ? style.id : createId(6),
    name,
    enabled: typeof style.enabled === 'boolean' ? style.enabled : true,
    css,
  }
}

const normalizeCustomUserScript = (
  script: Partial<CustomUserScript> | null | undefined,
  index: number,
): CustomUserScript | null => {
  if (!script) {
    return null
  }

  const js = typeof script.js === 'string' ? script.js.replace(/\s+$/, '') : ''
  if (!js.trim()) {
    return null
  }

  const name = typeof script.name === 'string' && script.name.trim() ? script.name.trim() : `Script ${index + 1}`

  return {
    id: typeof script.id === 'string' && script.id ? script.id : createId(6),
    name,
    enabled: typeof script.enabled === 'boolean' ? script.enabled : true,
    pinToHeader: typeof script.pinToHeader === 'boolean' ? script.pinToHeader : false,
    runAt: script.runAt === 'document-start' ? 'document-start' : 'document-end',
    js,
  }
}

const metadataBlockPattern = /\/\/\s*==UserScript==([\s\S]*?)\/\/\s*==\/UserScript==/

export const parseUserscriptMetadata = (source: string): { name: string; runAt: UserScriptRunAt } => {
  const block = source.match(metadataBlockPattern)?.[1]
  if (!block) {
    return { name: '', runAt: 'document-end' }
  }

  let name = ''
  let runAt: UserScriptRunAt = 'document-end'
  for (const line of block.split('\n')) {
    const match = line.match(/^\s*\/\/\s*@(\S+)\s+(.+?)\s*$/)
    if (!match) {
      continue
    }
    if (match[1] === 'name' && !name) {
      name = match[2].trim()
    }
    // Tampermonkey's document-body is still before the DOM YouTube renders into,
    // so it maps to our start slot; document-idle behaves like document-end.
    if (match[1] === 'run-at' && /^document-(start|body)$/.test(match[2].trim())) {
      runAt = 'document-start'
    }
  }

  return { name, runAt }
}

export const stripUserscriptMetadata = (source: string) => {
  return source.replace(metadataBlockPattern, '').replace(/^\s+/, '').replace(/\s+$/, '')
}

export const normalizeUserStyles = (data?: Partial<UserStylesSnapshot>): UserStylesSnapshot => {
  const defaults = createDefaultUserStylesSnapshot()
  const builtins = createDefaultBuiltinUserStyles()

  for (const id of builtinUserStyleIds) {
    builtins[id] = {
      enabled:
        typeof data?.builtins?.[id]?.enabled === 'boolean' ? data.builtins[id].enabled : defaults.builtins[id].enabled,
    }
  }

  const customStyles = (data?.customStyles || [])
    .map((style, index) => normalizeCustomUserStyle(style, index))
    .filter((style): style is CustomUserStyle => style != null)

  const customScripts = (data?.customScripts || [])
    .map((script, index) => normalizeCustomUserScript(script, index))
    .filter((script): script is CustomUserScript => script != null)

  return {
    schemaVersion: USER_STYLES_SCHEMA_VERSION,
    builtins,
    customStyles,
    customScripts,
  }
}

export const createNormalizedCustomUserStyle = (style: Partial<CustomUserStyle> | null | undefined, index: number) => {
  return normalizeCustomUserStyle(style, index)
}

export const createNormalizedCustomUserScript = (
  script: Partial<CustomUserScript> | null | undefined,
  index: number,
) => {
  return normalizeCustomUserScript(script, index)
}
