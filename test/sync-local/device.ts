// Each device has its own process, observables, sync metadata and MMKV. Only the platform
// runtime and the client wiring are replaced; queries hit the local Supabase stack.
import '../setup'
import { mock } from 'bun:test'
import { createClient } from '@supabase/supabase-js'
import { localConfig, type Command } from './protocol'

const { url, anonKey } = localConfig()
// The next POST to this path fails, to see what a lost push leaves behind.
let failPath: string | undefined
// The next request to this path waits until released, to change things while it is in flight.
let hold: { path: string; method?: string } | undefined
let releaseHeld: (() => void) | undefined
let heldStarted: (() => void) | undefined
const client = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  global: {
    fetch: Object.assign(
      (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
        const requestUrl = new URL(input instanceof Request ? input.url : String(input))
        const method = init?.method ?? 'GET'
        if (hold && requestUrl.pathname === `/rest/v1/${hold.path}` && (!hold.method || hold.method === method)) {
          hold = undefined
          heldStarted?.()
          return new Promise<void>((resolve) => {
            releaseHeld = resolve
          }).then(() => fetch(input, init))
        }
        if (failPath && method === 'POST' && requestUrl.pathname === `/rest/v1/${failPath}`) {
          failPath = undefined
          return Promise.resolve(
            new Response(JSON.stringify({ message: 'Injected push failure', code: 'TEST_FAILURE' }), {
              status: 403,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }
        return fetch(input, init)
      },
      { preconnect: fetch.preconnect },
    ),
  },
})
mock.module('@/lib/supabase/client', () => ({ supabase: client }))
// Feeds fetch YouTube whenever bookmarks change; nothing here is about them.
mock.module('@/lib/feeder', () => ({ feederLoop: async () => {}, refreshChannelFeed: async () => 'ok' }))

const { auth$ } = await import('@/states/auth')
const { bookmarks$, newBookmark } = await import('@/states/bookmarks')
const { folders$, newFolder } = await import('@/states/folders')
const { settings$, getSettingsSnapshot } = await import('@/states/settings')
const { userStyles$, getUserStylesSnapshot } = await import('@/states/user-styles')
const { syncMeta$ } = await import('@/states/sync-meta')
const { describeSyncError } = await import('@/lib/supabase/sync/base')
const { needsAccountChoice } = await import('@/lib/supabase/sync/session')
const { resolveAccountChoice } = await import('@/lib/supabase/sync/account')
const { syncSupabase } = await import('@/lib/supabase/sync')
const { bookmarksSyncer } = await import('@/lib/supabase/sync/bookmarks')
const { foldersSyncer } = await import('@/lib/supabase/sync/folders')
const { settingsSyncer } = await import('@/lib/supabase/sync/settings')
const { userStylesSyncer } = await import('@/lib/supabase/sync/user-styles')

// As MainPage does.
client.auth.onAuthStateChange((_event, session) => {
  auth$.assign({
    loaded: true,
    userId: session?.user.id,
    userEmail: session?.user.email,
    accessToken: session?.access_token,
  })
})

async function signIn(email: string, password: string) {
  const { error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw error
  // onAuthStateChange is told on a later turn.
  while (auth$.userEmail.peek() !== email) await Bun.sleep(5)
}

await signIn(process.env.NOUTUBE_SYNC_EMAIL!, process.env.NOUTUBE_SYNC_PASSWORD!)
auth$.plan.set('sync')

const syncers = { bookmarks: bookmarksSyncer, folders: foldersSyncer, settings: settingsSyncer, userStyles: userStylesSyncer }
// By key, as the app finds the bookmark of a page: urls are stored in their normalized form.
const findBookmark = (url: string) => bookmarks$.getBookmarkByUrl(url)

async function execute(command: Command) {
  switch (command.op) {
    case 'snapshot':
      return JSON.parse(
        JSON.stringify({
          bookmarks: bookmarks$.bookmarks.peek(),
          folders: folders$.folders.peek(),
          settings: getSettingsSnapshot(),
          styles: getUserStylesSnapshot(),
          meta: syncMeta$.peek(),
          userId: auth$.userId.peek(),
          needsAccountChoice: needsAccountChoice(),
        }),
      )
    case 'bookmark':
      bookmarks$.addBookmark(newBookmark({ url: command.url, title: command.title ?? command.url }))
      return bookmarks$.getBookmarkByUrl(command.url)?.id.peek() ?? null
    case 'renameBookmark': {
      const bookmark = findBookmark(command.url)
      if (!bookmark) throw new Error(`No bookmark ${command.url}`)
      bookmarks$.saveBookmark({ ...bookmark.peek(), title: command.title })
      break
    }
    case 'removeBookmark': {
      const id = findBookmark(command.url)?.id.peek()
      if (!id || !bookmarks$.removeById(id)) throw new Error(`No bookmark ${command.url}`)
      break
    }
    case 'folder': {
      const folder = newFolder('yt', { name: command.name })
      folders$.addFolder(folder)
      return folder.id
    }
    case 'moveBookmark': {
      const id = findBookmark(command.url)?.id.peek()
      if (!id || !bookmarks$.moveToFolder(id, command.folderId)) throw new Error(`No bookmark ${command.url}`)
      break
    }
    case 'removeFolder': {
      const folder = folders$.folders.peek().find((item) => item.id === command.id)
      if (!folder) throw new Error(`No folder ${command.id}`)
      folders$.removeFolder(folder)
      bookmarks$.removeByFolder(folder.id)
      break
    }
    case 'settings':
      settings$.assign(command.value)
      break
    case 'style':
      userStyles$.setBuiltinEnabled('hide-shorts-navbar', command.enabled)
      break
    case 'customScript':
      return userStyles$.addCustomScript({ name: command.name, enabled: true, pinToHeader: false, runAt: 'document-end', js: 'void 0' })
    case 'failNextPush':
      failPath = command.path
      break
    case 'signIn':
      await signIn(command.email, command.password)
      break
    case 'accountChoice':
      await resolveAccountChoice(command.choice)
      break
    case 'holdNextRequest':
      hold = { path: command.path, method: command.method }
      // Answers once the request is in flight, not when it is released.
      return new Promise<null>((resolve) => {
        heldStarted = () => resolve(null)
      })
    case 'releaseFetch':
      releaseHeld?.()
      releaseHeld = undefined
      break
    case 'restoreBackup':
      syncers[command.scope].restoreBackup()
      break
    case 'forgetBase':
      syncers[command.scope].setMeta({ base: undefined })
      break
    case 'sync':
      if (command.scope) await syncers[command.scope].syncNow()
      else await syncSupabase()
      break
  }
  return null
}

process.on('message', async (message: { id: number; command: Command }) => {
  try {
    process.send?.({ id: message.id, value: await execute(message.command) })
  } catch (error) {
    process.send?.({ id: message.id, error: describeSyncError(error) })
  }
})
process.send?.({ ready: true })
