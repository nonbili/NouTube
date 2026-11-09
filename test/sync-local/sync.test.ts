import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { Device } from './device-client'
import { localConfig, type Snapshot } from './protocol'

const tables = ['nou_bookmarks', 'nou_folders', 'nou_settings', 'nou_user_styles'] as const
const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }

// Urls are stored normalized (the host differs by platform): pages are told apart by their path.
const page = (url: string) => new URL(url).pathname
const live = (snapshot: Snapshot) =>
  snapshot.bookmarks
    .filter((bookmark) => !bookmark.json.deleted)
    .map((bookmark) => page(bookmark.url))
    .sort()

// Never opens connections during ordinary `bun test`, including in CI.
const local = process.env.NOUTUBE_SYNC_LOCAL === '1' ? describe : describe.skip
local('sync against local Supabase', () => {
  let admin: SupabaseClient
  const users: { id: string; email: string; password: string; client: SupabaseClient }[] = []
  const devices: Device[] = []

  async function device(userIndex = 0) {
    const user = users[userIndex]
    const instance = await Device.start(user.email, user.password)
    devices.push(instance)
    return instance
  }

  // Writes need a plan: the latest App Store subscription decides, as in getNoutubeEntitlement.
  async function setPlan(userId: string, status: 'active' | 'expired') {
    const { error } = await admin.schema('noutube').from('app_store_subscriptions').insert({
      original_transaction_id: crypto.randomUUID(),
      user_id: userId,
      product_id: 'noutube_sync',
      status,
      expires_at: null,
      latest_transaction_jws: 'test',
    })
    if (error) throw error
  }

  const rows = async (table: (typeof tables)[number], userIndex = 0) => {
    const { data, error } = await users[userIndex].client.from(table).select('*')
    if (error) throw error
    return data as any[]
  }

  beforeEach(async () => {
    const { url, anonKey, serviceKey } = localConfig()
    admin = createClient(url, serviceKey, options)
    for (let index = 0; index < 2; index++) {
      const email = `noutube-sync-${crypto.randomUUID()}@example.com`
      const password = crypto.randomUUID()
      const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
      if (error) throw error
      const user = { id: data.user.id, email, password, client: createClient(url, anonKey, options) }
      users.push(user)
      const login = await user.client.auth.signInWithPassword({ email, password })
      if (login.error) throw login.error
      await setPlan(data.user.id, 'active')
    }
    // Fail clearly if the NouTube schema was not applied to the stack.
    for (const table of tables) {
      const { error } = await users[0].client.from(table).select('user_id').limit(1)
      if (error) throw new Error(`Local ${table} unavailable: ${error.message}`)
    }
  })

  afterEach(async () => {
    await Promise.all(devices.splice(0).map((instance) => instance.close()))
    const errors: string[] = []
    for (const user of users.splice(0)) {
      const { error } = await admin.auth.admin.deleteUser(user.id)
      if (error) errors.push(error.message)
    }
    if (errors.length) throw new Error(`Test user cleanup failed: ${errors.join(', ')}`)
  })

  it('keeps bookmarks and folders added on two devices, and carries moves and removals across', async () => {
    const a = await device()
    const b = await device()
    await a.command({ op: 'bookmark', url: 'https://www.youtube.com/@alpha' })
    const folder = (await a.command({ op: 'folder', name: 'Music' })) as string
    await b.command({ op: 'bookmark', url: 'https://www.youtube.com/@beta' })
    await Promise.all([a.sync(), b.sync()])
    await Promise.all([a.sync(), b.sync()])

    for (const instance of [a, b]) {
      const snapshot = await instance.snapshot()
      expect(live(snapshot)).toEqual(['/@alpha', '/@beta'])
      expect(snapshot.folders.map((item) => item.id)).toEqual([folder])
      expect(snapshot.meta.bookmarks.pendingIds).toEqual([])
      expect(snapshot.meta.folders.pendingIds).toEqual([])
    }

    await b.command({ op: 'moveBookmark', url: 'https://www.youtube.com/@beta', folderId: folder })
    await a.command({ op: 'removeBookmark', url: 'https://www.youtube.com/@alpha' })
    await a.sync()
    await b.sync()
    await a.sync()

    for (const instance of [a, b]) {
      const snapshot = await instance.snapshot()
      expect(live(snapshot)).toEqual(['/@beta'])
      expect(snapshot.bookmarks.find((item) => item.url.endsWith('@beta'))?.json.folder).toBe(folder)
    }
    // A removal is a row the other devices pull, not a row gone from the server.
    const alpha = (await rows('nou_bookmarks')).find((row) => page(row.url) === '/@alpha')
    expect(alpha?.json.deleted).toBe(true)
  })

  it('keeps a rename made here over the copy another device wrote, and takes theirs for other rows', async () => {
    const a = await device()
    const b = await device()
    await a.command({ op: 'bookmark', url: 'https://www.youtube.com/@one', title: 'one' })
    await a.command({ op: 'bookmark', url: 'https://www.youtube.com/@two', title: 'two' })
    await a.sync('bookmarks')
    await b.sync('bookmarks')

    await b.command({ op: 'renameBookmark', url: 'https://www.youtube.com/@one', title: 'one by b' })
    await b.command({ op: 'renameBookmark', url: 'https://www.youtube.com/@two', title: 'two by b' })
    await b.sync('bookmarks')
    await a.command({ op: 'renameBookmark', url: 'https://www.youtube.com/@one', title: 'one by a' })
    await a.sync('bookmarks')
    await b.sync('bookmarks')

    for (const instance of [a, b]) {
      const titles = (await instance.snapshot()).bookmarks.map((item) => item.title).sort()
      expect(titles).toEqual(['one by a', 'two by b'])
    }
  })

  it('folds the same page saved on two devices into the one row the server keeps', async () => {
    const a = await device()
    const b = await device()
    const url = 'https://www.youtube.com/@same'
    const idA = (await a.command({ op: 'bookmark', url, title: 'from a' })) as string
    const idB = await b.command({ op: 'bookmark', url, title: 'from b' })
    expect(idA).not.toBe(idB)

    await a.sync('bookmarks')
    await b.sync('bookmarks')
    await a.sync('bookmarks')

    const server = (await rows('nou_bookmarks')).filter((row) => page(row.url) === page(url))
    expect(server.map((row) => row.id)).toEqual([idA])
    for (const instance of [a, b]) {
      const snapshot = await instance.snapshot()
      expect(snapshot.bookmarks.filter((item) => page(item.url) === page(url)).map((item) => item.id)).toEqual([idA])
      expect(snapshot.meta.bookmarks.pendingIds).toEqual([])
      expect(snapshot.meta.bookmarks.lastError).toBeUndefined()
    }
    expect((await b.snapshot()).bookmarks.find((item) => page(item.url) === page(url))?.title).toBe('from b')
  })

  it('pages beyond the API row limit with tied timestamps, then pulls only what changed', async () => {
    const user = users[0]
    const seeded = Array.from({ length: 1005 }, (_, index) => ({
      id: `seed-${String(index).padStart(4, '0')}`,
      user_id: user.id,
      url: `https://www.youtube.com/@seed${index}`,
      title: `seed ${index}`,
      json: {},
    }))
    // One INSERT transaction makes the now() trigger give every row the same timestamp.
    expect((await user.client.from('nou_bookmarks').insert(seeded)).error).toBeNull()
    const sample = await user.client.from('nou_bookmarks').select('updated_at').limit(2)
    expect(sample.data![0].updated_at).toBe(sample.data![1].updated_at)

    const a = await device()
    await a.sync('bookmarks')
    let snapshot = await a.snapshot()
    expect(snapshot.bookmarks.map((item) => item.id).sort()).toEqual(seeded.map((row) => row.id))
    expect(snapshot.meta.bookmarks.cursor).toBeString()
    const fullPullAt = snapshot.meta.bookmarks.lastFullPullAt

    await user.client.from('nou_bookmarks').update({ title: 'renamed elsewhere' }).eq('id', 'seed-0003')
    await a.sync('bookmarks')
    snapshot = await a.snapshot()
    expect(snapshot.bookmarks.find((item) => item.id === 'seed-0003')?.title).toBe('renamed elsewhere')
    expect(snapshot.meta.bookmarks.lastFullPullAt).toBe(fullPullAt)
  })

  it('keeps every account to its own rows through the API', async () => {
    const [one, two] = users
    await one.client.rpc('nou_put_doc', { p_user: one.id, p_table: 'nou_settings', p_json: { a: 1 }, p_base: null })
    expect((await one.client.from('nou_bookmarks').insert({ id: crypto.randomUUID(), user_id: one.id, url: 'https://x', title: 'x', json: {} })).error).toBeNull()
    expect((await one.client.from('nou_folders').insert({ id: crypto.randomUUID(), user_id: one.id, name: 'F', json: { tab: 'yt' } })).error).toBeNull()

    for (const table of tables) {
      const { data, error } = await two.client.from(table).select('user_id')
      expect(error).toBeNull()
      expect(data).toEqual([])
    }
    const [own] = await rows('nou_bookmarks')
    const hijack = await two.client.from('nou_bookmarks').upsert({ ...own, user_id: two.id, title: 'hijacked' })
    expect(hijack.error).not.toBeNull()
    const foreign = await two.client.rpc('nou_put_doc', { p_user: one.id, p_table: 'nou_settings', p_json: {}, p_base: null })
    expect(foreign.error?.code).toBe('42501')
    expect((await rows('nou_bookmarks'))[0].title).toBe('x')
  })

  it('refuses sync writes from an account without a plan, and from one whose plan lapsed', async () => {
    const [, two] = users
    await setPlan(two.id, 'expired')
    const bookmark = await two.client.from('nou_bookmarks').insert({ id: crypto.randomUUID(), user_id: two.id, url: 'https://x', title: 'x', json: {} })
    expect(bookmark.error?.code).toBe('42501')
    const doc = await two.client.rpc('nou_put_doc', { p_user: two.id, p_table: 'nou_settings', p_json: {}, p_base: null })
    expect(doc.error?.message).toContain('requires a plan')

    // The device sees the refusal and keeps the change to push once the plan is back.
    const b = await device(1)
    await b.command({ op: 'bookmark', url: 'https://www.youtube.com/@waiting' })
    await expect(b.sync('bookmarks')).rejects.toThrow()
    expect((await b.snapshot()).meta.bookmarks.pendingIds).toHaveLength(1)
    await setPlan(two.id, 'active')
    await b.sync('bookmarks')
    expect((await rows('nou_bookmarks', 1)).map((row) => page(row.url))).toEqual(['/@waiting'])
  })

  it('retries rows whose push failed', async () => {
    const a = await device()
    await a.sync()
    await a.command({ op: 'bookmark', url: 'https://www.youtube.com/@retry' })
    await a.command({ op: 'failNextPush', path: 'nou_bookmarks' })
    await expect(a.sync('bookmarks')).rejects.toThrow('Injected push failure')
    let snapshot = await a.snapshot()
    expect(snapshot.meta.bookmarks.pendingIds).toHaveLength(1)
    expect(snapshot.meta.bookmarks.lastError).toContain('Injected push failure')

    await a.sync('bookmarks')
    snapshot = await a.snapshot()
    expect(snapshot.meta.bookmarks.pendingIds).toEqual([])
    expect(snapshot.meta.bookmarks.lastError).toBeUndefined()
    expect((await rows('nou_bookmarks')).map((row) => page(row.url))).toEqual(['/@retry'])
  })

  it('pushes again a bookmark renamed while its push was in flight', async () => {
    const a = await device()
    await a.sync('bookmarks')
    await a.command({ op: 'bookmark', url: 'https://www.youtube.com/@moving', title: 'first' })
    await a.command({ op: 'holdNextRequest', path: 'nou_bookmarks', method: 'POST' }).then(() => undefined)
    const running = a.sync('bookmarks')
    await Bun.sleep(50)
    await a.command({ op: 'renameBookmark', url: 'https://www.youtube.com/@moving', title: 'second' })
    await a.command({ op: 'releaseFetch' })
    await running

    expect((await rows('nou_bookmarks'))[0].title).toBe('second')
    expect((await a.snapshot()).meta.bookmarks.pendingIds).toEqual([])
  })

  it('round-trips documents, and merges settings two devices changed key by key', async () => {
    const a = await device()
    const b = await device()
    await a.command({ op: 'settings', value: { autoHideHeader: true } })
    await a.command({ op: 'style', enabled: true })
    await a.sync()
    await b.sync()
    let snapshot = await b.snapshot()
    expect(snapshot.settings.autoHideHeader).toBe(true)
    expect(snapshot.styles.builtins['hide-shorts-navbar'].enabled).toBe(true)

    await a.command({ op: 'settings', value: { headerPosition: 'bottom' } })
    await b.command({ op: 'settings', value: { autoHideSidebar: true } })
    await a.sync('settings')
    await b.sync('settings')
    await a.sync('settings')
    for (const instance of [a, b]) {
      snapshot = await instance.snapshot()
      expect(snapshot.settings).toMatchObject({ autoHideHeader: true, headerPosition: 'bottom', autoHideSidebar: true })
      expect(snapshot.meta.settings.backup).toBeUndefined()
    }
  })

  it('takes the other device on a setting both changed, keeping a backup to restore', async () => {
    const a = await device()
    const b = await device()
    await a.sync('settings')
    await b.sync('settings')
    await a.command({ op: 'settings', value: { translationTargetLanguage: 'ja' } })
    await a.sync('settings')
    await b.command({ op: 'settings', value: { translationTargetLanguage: 'fr', autoHideHeader: true } })
    await b.sync('settings')

    let snapshot = await b.snapshot()
    // What only b changed stays; what both changed is a's, with b's kept to put back.
    expect(snapshot.settings).toMatchObject({ translationTargetLanguage: 'ja', autoHideHeader: true })
    expect(snapshot.meta.settings.backup?.value.translationTargetLanguage).toBe('fr')

    await b.command({ op: 'restoreBackup', scope: 'settings' })
    await b.sync('settings')
    await a.sync('settings')
    snapshot = await a.snapshot()
    expect(snapshot.settings).toMatchObject({ translationTargetLanguage: 'fr', autoHideHeader: true })
  })

  it('merges custom scripts added on two devices by id', async () => {
    const a = await device()
    const b = await device()
    await a.sync('userStyles')
    await b.sync('userStyles')
    await a.command({ op: 'customScript', name: 'from a' })
    await b.command({ op: 'customScript', name: 'from b' })
    await a.sync('userStyles')
    await b.sync('userStyles')
    await a.sync('userStyles')
    for (const instance of [a, b]) {
      const names = (await instance.snapshot()).styles.customScripts.map((script) => script.name).sort()
      expect(names).toEqual(['from a', 'from b'])
    }
  })

  it('merges again when another device wrote a document between the read and the write', async () => {
    const a = await device()
    const b = await device()
    await a.sync('settings')
    await b.sync('settings')
    await a.command({ op: 'settings', value: { autoHideHeader: true } })
    await a.command({ op: 'holdNextRequest', path: 'rpc/nou_put_doc' })
    const running = a.sync('settings')
    await b.command({ op: 'settings', value: { autoHideSidebar: true } })
    await b.sync('settings')
    await a.command({ op: 'releaseFetch' })
    await running

    const [row] = await rows('nou_settings')
    expect(row.json).toMatchObject({ autoHideHeader: true, autoHideSidebar: true })
    expect((await a.snapshot()).settings).toMatchObject({ autoHideHeader: true, autoHideSidebar: true })
  })

  it('pauses sync on another account until the user chooses, uploading nothing meanwhile', async () => {
    const a = await device()
    await a.command({ op: 'bookmark', url: 'https://www.youtube.com/@mine' })
    await a.sync()
    await a.command({ op: 'signIn', email: users[1].email, password: users[1].password })
    await a.command({ op: 'bookmark', url: 'https://www.youtube.com/@later' })
    await a.sync()

    expect((await a.snapshot()).needsAccountChoice).toBe(true)
    for (const table of tables) expect(await rows(table, 1)).toEqual([])
  })

  it("replaces the device data with the account's, keeping a backup and pushing nothing of the old account", async () => {
    const b = await device(1)
    await b.command({ op: 'bookmark', url: 'https://www.youtube.com/@theirs' })
    await b.command({ op: 'settings', value: { headerPosition: 'bottom' } })
    await b.sync()

    const a = await device()
    await a.command({ op: 'bookmark', url: 'https://www.youtube.com/@mine' })
    await a.sync()
    await a.command({ op: 'signIn', email: users[1].email, password: users[1].password })
    await a.command({ op: 'accountChoice', choice: 'useAccount' })

    const snapshot = await a.snapshot()
    expect(snapshot.needsAccountChoice).toBe(false)
    expect(live(snapshot)).toEqual(['/@theirs'])
    expect(snapshot.settings.headerPosition).toBe('bottom')
    expect(snapshot.meta.ownerUserId).toBe(users[1].id)
    expect(snapshot.meta.switchBackup?.bookmarksCsv).toContain('@mine')
    expect((await rows('nou_bookmarks', 1)).map((row) => page(row.url))).toEqual(['/@theirs'])
  })

  it('merges the device into the account under new ids, so no row of the old account is touched', async () => {
    const b = await device(1)
    await b.command({ op: 'bookmark', url: 'https://www.youtube.com/@theirs' })
    await b.command({ op: 'folder', name: 'Music' })
    await b.sync()

    const a = await device()
    const folder = (await a.command({ op: 'folder', name: 'Music' })) as string
    await a.command({ op: 'bookmark', url: 'https://www.youtube.com/@mine' })
    await a.command({ op: 'moveBookmark', url: 'https://www.youtube.com/@mine', folderId: folder })
    await a.command({ op: 'bookmark', url: 'https://www.youtube.com/@theirs' })
    await a.sync()
    const before = await rows('nou_bookmarks')

    await a.command({ op: 'signIn', email: users[1].email, password: users[1].password })
    await a.command({ op: 'accountChoice', choice: 'mergeDevice' })

    const accountRows = await rows('nou_bookmarks', 1)
    expect(accountRows.map((row) => page(row.url)).sort()).toEqual(['/@mine', '/@theirs'])
    const accountFolders = await rows('nou_folders', 1)
    expect(accountFolders).toHaveLength(1)
    expect(accountRows.find((row) => page(row.url) === '/@mine')?.json.folder).toBe(accountFolders[0].id)
    // The old account's rows are as they were.
    expect(await rows('nou_bookmarks')).toEqual(before)
    const snapshot = await a.snapshot()
    expect(snapshot.meta.bookmarks.pendingIds).toEqual([])
    expect(snapshot.meta.bookmarks.lastError).toBeUndefined()
  })

  it('drops a run whose account changed while its request was in flight', async () => {
    const a = await device()
    await a.command({ op: 'bookmark', url: 'https://www.youtube.com/@mine' })
    await a.command({ op: 'holdNextRequest', path: 'nou_bookmarks', method: 'GET' })
    const running = a.sync('bookmarks')
    await a.command({ op: 'signIn', email: users[1].email, password: users[1].password })
    await a.command({ op: 'releaseFetch' })
    await running

    expect(await rows('nou_bookmarks', 1)).toEqual([])
    expect(await rows('nou_bookmarks')).toEqual([])
  })
})
