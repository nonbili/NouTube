import { observable, syncState, when } from '@legendapp/state'
import { auth$ } from '@/states/auth'
import { syncMeta$ } from '@/states/sync-meta'

/** The account a sync run started for: the run stops when either changed meanwhile. */
export interface SyncSession {
  userId: string
  generation: number
}

// Bumped on every change of account, and when the data on this device changes hands, so a run
// that started before cannot finish after, even when the account went A, B and back to A.
let generation = 0
let switching = false

auth$.userId.onChange(() => {
  generation += 1
})

export const bumpSyncGeneration = () => {
  generation += 1
}

export const getSyncGeneration = () => generation

export const setSwitchingAccount = (value: boolean) => {
  switching = value
}

export const hasSyncPlan = () => {
  const { userId, plan } = auth$.get()
  return Boolean(userId && plan && plan !== 'free')
}

/**
 * The account the synced data on this device belongs to. Data synced before the owner was kept
 * belongs to the account its bookmarks were last pulled from; else to no one yet.
 */
export const getSyncOwner = () => syncMeta$.ownerUserId.get() ?? syncMeta$.bookmarks.userId.get()

/** Signed in to another account than the one the data here belongs to: nothing syncs until the user chooses. */
export const needsAccountChoice = () => {
  const userId = auth$.userId.get()
  const owner = getSyncOwner()
  return Boolean(userId && owner && owner !== userId)
}

export const accountChoice$ = observable(() => hasSyncPlan() && needsAccountChoice())

export const canSync = () => hasSyncPlan() && !switching && !needsAccountChoice()

/** Starts a run for the signed-in account. Data no one owns yet becomes its own, before anything is sent. */
export const beginSync = async (): Promise<SyncSession | null> => {
  await when(() => syncState(syncMeta$).isPersistLoaded.get())
  const userId = auth$.userId.peek()
  if (!userId || !canSync()) return null
  if (!syncMeta$.ownerUserId.peek()) syncMeta$.ownerUserId.set(userId)
  return { userId, generation }
}

export const isCurrentSession = (session: SyncSession) =>
  session.generation === generation && auth$.userId.peek() === session.userId && canSync()
