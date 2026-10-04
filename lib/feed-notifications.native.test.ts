import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import { AppState } from 'react-native'
import i18n from 'i18next'
import { settings$ } from '@/states/settings'

let task: () => Promise<number>
let notificationHandler: { handleNotification: () => Promise<any> }
const nativeSettings = mock((_settings: any) => {})
const feederLoop = mock(async () => true)
mock.module('@/modules/nou-tube-view', () => ({ default: { setSettings: nativeSettings } }))
mock.module('expo-localization', () => ({ getLocales: () => [{ languageCode: 'en' }] }))
mock.module('./feeder', () => ({ feederLoop }))

let registered = false
let granted = true
let available = true
let responseListener: (response: any) => void
const schedule = mock(async (_notification: any) => 'notification-id')
const register = mock(async (_name: string, _options: any) => { registered = true })
const unregister = mock(async (_name: string) => { registered = false })
const requestPermissions = mock(async () => ({ granted }))
const removeListener = mock(() => {})

mock.module('expo-task-manager', () => ({
  defineTask: (_name: string, callback: typeof task) => { task = callback },
  isTaskRegisteredAsync: async () => registered,
}))
mock.module('expo-background-task', () => ({
  BackgroundTaskStatus: { Available: 2, Restricted: 1 },
  BackgroundTaskResult: { Success: 1, Failed: 2 },
  getStatusAsync: async () => available ? 2 : 1,
  registerTaskAsync: register,
  unregisterTaskAsync: unregister,
}))
mock.module('expo-notifications', () => ({
  AndroidImportance: { DEFAULT: 3 },
  DEFAULT_ACTION_IDENTIFIER: 'default',
  setNotificationHandler: (handler: typeof notificationHandler) => { notificationHandler = handler },
  setNotificationChannelAsync: async () => {},
  requestPermissionsAsync: requestPermissions,
  getPermissionsAsync: async () => ({ granted }),
  scheduleNotificationAsync: schedule,
  addNotificationResponseReceivedListener: (listener: typeof responseListener) => {
    responseListener = listener
    return { remove: removeListener }
  },
  getLastNotificationResponseAsync: async () => null,
  clearLastNotificationResponseAsync: async () => {},
}))

const { syncNativeSettings } = await import('./native-settings.native')
mock.module('./native-settings', () => ({ syncNativeSettings }))

const { setFeedNotificationsEnabled, syncFeedNotificationTask, notifyFeedVideos, listenFeedNotifications } =
  await import('./feed-notifications.native')

beforeEach(() => {
  Object.assign(AppState, { currentState: 'background' })
  nativeSettings.mockClear()
  feederLoop.mockClear()
  feederLoop.mockImplementation(async () => true)
  settings$.language.set(null)
  registered = false
  granted = true
  available = true
  register.mockClear()
  unregister.mockClear()
  requestPermissions.mockClear()
  schedule.mockClear()
  removeListener.mockClear()
  settings$.feedsEnabled.set(true)
  settings$.feedNotificationsEnabled.set(false)
})
afterEach(() => {
  settings$.feedNotificationsEnabled.set(false)
  settings$.language.set(null)
})

describe('mobile feed notifications', () => {
  it('requests permission and registers two-hour background checks only after opting in', async () => {
    expect(await setFeedNotificationsEnabled(true)).toBe(true)
    expect(requestPermissions).toHaveBeenCalledTimes(1)
    expect(register).toHaveBeenCalledWith('noutube-feed-notifications', { minimumInterval: 120 })
    expect(settings$.feedNotificationsEnabled.get()).toBe(true)
  })

  it('leaves alerts off when notification permission or background activity is denied', async () => {
    granted = false
    expect(await setFeedNotificationsEnabled(true)).toBe(false)
    granted = true
    available = false
    expect(await setFeedNotificationsEnabled(true)).toBe(false)
    expect(register).not.toHaveBeenCalled()
    expect(settings$.feedNotificationsEnabled.get()).toBe(false)
  })

  it('unregisters background checks when alerts or feeds are disabled', async () => {
    await setFeedNotificationsEnabled(true)
    await setFeedNotificationsEnabled(false)
    expect(unregister).toHaveBeenCalledTimes(1)
    await setFeedNotificationsEnabled(true)
    settings$.feedsEnabled.set(false)
    await syncFeedNotificationTask()
    expect(unregister).toHaveBeenCalledTimes(2)
    settings$.feedsEnabled.set(true)
  })

  it('preserves the opt-in through a temporary restriction and resumes checks afterward', async () => {
    await setFeedNotificationsEnabled(true)
    available = false
    expect(await syncFeedNotificationTask()).toBe(false)
    expect(settings$.feedNotificationsEnabled.get()).toBe(true)
    expect(unregister).toHaveBeenCalledTimes(1)
    expect(await task()).toBe(1)
    expect(feederLoop).not.toHaveBeenCalled()
    await notifyFeedVideos([{ channel: 'Channel', count: 2 }])
    expect(schedule).not.toHaveBeenCalled()
    expect(register).toHaveBeenCalledTimes(1)

    available = true
    expect(await syncFeedNotificationTask()).toBe(true)
    expect(settings$.feedNotificationsEnabled.get()).toBe(true)
    expect(register).toHaveBeenCalledTimes(2)
    expect(requestPermissions).toHaveBeenCalledTimes(1)
    expect(await task()).toBe(1)
    expect(feederLoop).toHaveBeenCalledTimes(1)
  })

  it('clears the opt-in for revoked permission even while background execution is restricted', async () => {
    await setFeedNotificationsEnabled(true)
    available = false
    granted = false
    expect(await syncFeedNotificationTask()).toBe(false)
    expect(settings$.feedNotificationsEnabled.get()).toBe(false)
    expect(unregister).toHaveBeenCalledTimes(1)
  })

  it('does not register the same task twice', async () => {
    await setFeedNotificationsEnabled(true)
    await Promise.all([syncFeedNotificationTask(), syncFeedNotificationTask()])
    expect(register).toHaveBeenCalledTimes(1)
  })

  it('sends a feed alert only while opted in and permitted', async () => {
    await notifyFeedVideos([{ channel: 'Channel', count: 2 }])
    expect(schedule).not.toHaveBeenCalled()
    await setFeedNotificationsEnabled(true)
    await notifyFeedVideos([{ channel: 'Channel', count: 2 }])
    expect(schedule.mock.calls[0][0].content.data).toEqual({ noutubeFeed: true })
    granted = false
    await notifyFeedVideos([{ channel: 'Channel', count: 3 }])
    expect(schedule).toHaveBeenCalledTimes(1)
  })

  it('defines and executes the headless task without mounting a route', async () => {
    await setFeedNotificationsEnabled(true)
    settings$.language.set('ja')
    expect(await task()).toBe(1)
    expect(feederLoop).toHaveBeenCalledTimes(1)
    expect(i18n.language).toBe('ja')
    const payload = nativeSettings.mock.calls[0][0]
    expect(payload.proxyEnabled).toBe(settings$.proxyEnabled.get())
    expect(payload.playbackRate).toBe(settings$.playbackRate.get())
    expect(Object.values(payload).some((value) => typeof value === 'function')).toBe(false)
    expect(payload.feedNotificationsEnabled).toBeUndefined()
  })

  it('returns Failed when the background feed check fails', async () => {
    await setFeedNotificationsEnabled(true)
    feederLoop.mockImplementation(async () => false)
    expect(await task()).toBe(2)
  })

  it('turns the toggle off and unregisters after permission is revoked', async () => {
    await setFeedNotificationsEnabled(true)
    granted = false
    await syncFeedNotificationTask()
    expect(settings$.feedNotificationsEnabled.get()).toBe(false)
    expect(unregister).toHaveBeenCalledTimes(1)
    expect(await task()).toBe(1)
    expect(feederLoop).not.toHaveBeenCalled()
  })

  it('suppresses foreground notifications and foreground banners', async () => {
    await setFeedNotificationsEnabled(true)
    Object.assign(AppState, { currentState: 'active' })
    await notifyFeedVideos([{ channel: 'Channel', count: 2 }])
    expect(schedule).not.toHaveBeenCalled()
    const behavior = await notificationHandler.handleNotification()
    expect(behavior.shouldShowBanner).toBe(false)
    expect(behavior.shouldShowList).toBe(false)
  })

  it('collapses multiple channels into a single summary notification', async () => {
    await setFeedNotificationsEnabled(true)
    await notifyFeedVideos([{ channel: 'A', count: 2 }, { channel: 'B', count: 3 }])
    expect(schedule).toHaveBeenCalledTimes(1)
    expect(schedule.mock.calls[0][0].content.body).toBe('5 new videos from 2 channels')
  })

  it('opens Feeds once for a feed notification tap and removes the listener on cleanup', () => {
    const open = mock(() => {})
    const cleanup = listenFeedNotifications(open)
    const response = (data: any) => ({
      actionIdentifier: 'default',
      notification: { request: { identifier: 'tap-test', content: { data } } },
    })
    responseListener(response(undefined))
    responseListener(response({ noutubeFeed: true }))
    responseListener(response({ noutubeFeed: true }))
    expect(open).toHaveBeenCalledTimes(1)
    cleanup()
    expect(removeListener).toHaveBeenCalledTimes(1)
  })
})
