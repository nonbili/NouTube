import * as BackgroundTask from 'expo-background-task'
import * as TaskManager from 'expo-task-manager'
import type { NotificationResponse } from 'expo-notifications'
import { syncState, when } from '@legendapp/state'
import { AppState, Platform } from 'react-native'
import { changeLanguage, t } from 'i18next'
import { getLocales } from 'expo-localization'
import { resolveI18nLanguageFromExpoLocale } from './i18n'
import { syncNativeSettings } from './native-settings'
import type { FeedNotificationUpdate } from './feed-notification-videos'
import { settings$ } from '@/states/settings'
import { pushToast } from '@/states/toast'
import { ui$ } from '@/states/ui'
import NouTubeViewModule from '@/modules/nou-tube-view'

// F-Droid builds strip the Firebase-backed push token module, so importing
// expo-notifications throws at startup there. NouTube's own module posts the
// notifications on Android then.
let Notifications: typeof import('expo-notifications') | null = null
try {
  Notifications = require('expo-notifications')
} catch (error) {
  console.warn('expo-notifications unavailable:', error)
}

type NativeNotifications = Omit<typeof NouTubeViewModule, 'addListener'> & {
  addListener?: (eventName: 'feedNotificationOpened', listener: () => void) => { remove?: () => void }
}
const nativeNotifications =
  Platform.OS === 'android' && !Notifications && NouTubeViewModule.postNotification
    ? (NouTubeViewModule as NativeNotifications)
    : null
const canNotify = Boolean(Notifications || nativeNotifications)

async function hasPermission() {
  if (Notifications) return (await Notifications.getPermissionsAsync()).granted
  return nativeNotifications?.areNotificationsEnabled?.() ?? false
}

async function requestPermission() {
  if (Notifications) return (await Notifications.requestPermissionsAsync()).granted
  return (await nativeNotifications?.requestNotificationPermission?.()) ?? false
}

let nativeId = 1000 + Math.floor(Math.random() * 0x40000000)

const TASK_NAME = 'noutube-feed-notifications'
const CHANNEL_ID = 'feed-videos'
const isAppActive = () => AppState.currentState === 'active'

Notifications?.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: !isAppActive(),
    shouldShowList: !isAppActive(),
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
})

TaskManager.defineTask(TASK_NAME, async () => {
  try {
    await when(syncState(settings$).isPersistLoaded)
    if (!(await syncFeedNotificationTask())) {
      return BackgroundTask.BackgroundTaskResult.Success
    }
    // The foreground screen normally applies these settings. A headless launch
    // must also restore the proxy before fetching feeds through the native API.
    await applyNotificationLanguage()
    syncNativeSettings()
    const { feederLoop } = await import('./feeder')
    const success = await feederLoop()
    return success === false ? BackgroundTask.BackgroundTaskResult.Failed : BackgroundTask.BackgroundTaskResult.Success
  } catch (error) {
    console.error('Background feed check failed:', error)
    return BackgroundTask.BackgroundTaskResult.Failed
  }
})

async function applyNotificationLanguage() {
  const language = settings$.language.get() || resolveI18nLanguageFromExpoLocale(getLocales()[0]) || 'en'
  await changeLanguage(language)
}

async function ensureChannel() {
  if (Notifications && Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: t('feeds.notificationTitle'),
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: null,
    })
  }
}

let registration = Promise.resolve(false)
export function syncFeedNotificationTask(): Promise<boolean> {
  registration = registration.catch(() => false).then(async () => {
    await when(syncState(settings$).isPersistLoaded)
    let available = false
    // Without any way to notify the opt-in is kept for foreground toasts, but
    // background delivery stays unavailable.
    if (canNotify && settings$.feedNotificationsEnabled.get()) {
      if (!(await hasPermission())) {
        settings$.feedNotificationsEnabled.set(false)
      } else {
        available = (await BackgroundTask.getStatusAsync()) === BackgroundTask.BackgroundTaskStatus.Available
      }
    }
    // System restrictions suspend delivery without discarding the user's opt-in.
    const enabled = settings$.feedsEnabled.get() && settings$.feedNotificationsEnabled.get() && available
    const registered = await TaskManager.isTaskRegisteredAsync(TASK_NAME)
    if (enabled && !registered) {
      await BackgroundTask.registerTaskAsync(TASK_NAME, { minimumInterval: 120 })
    } else if (!enabled && registered) {
      await BackgroundTask.unregisterTaskAsync(TASK_NAME)
    }
    return enabled
  })
  return registration
}

export async function setFeedNotificationsEnabled(enabled: boolean): Promise<boolean> {
  if (enabled && canNotify) {
    if ((await BackgroundTask.getStatusAsync()) !== BackgroundTask.BackgroundTaskStatus.Available) return false
    await applyNotificationLanguage()
    await ensureChannel()
    if (!(await requestPermission())) return false
  }
  settings$.feedNotificationsEnabled.set(enabled)
  try {
    await syncFeedNotificationTask()
  } catch (error) {
    settings$.feedNotificationsEnabled.set(false)
    throw error
  }
  return true
}

export async function notifyFeedVideos(updates: FeedNotificationUpdate[]): Promise<void> {
  const count = updates.reduce((sum, update) => sum + update.count, 0)
  if (!count || !settings$.feedsEnabled.get() || !settings$.feedNotificationsEnabled.get()) return
  const backgroundEnabled = await syncFeedNotificationTask()
  if (!settings$.feedNotificationsEnabled.get()) return
  await applyNotificationLanguage()
  const body = updates.length === 1
    ? t('feeds.notificationBody', { count, channel: updates[0].channel })
    : t('feeds.notificationSummary', { count, channels: updates.length })
  const showFeedToast = () => pushToast(body, () => ui$.feedModalOpen.set(true))
  if (isAppActive()) {
    showFeedToast()
    return
  }
  if (!canNotify || !backgroundEnabled) return
  await ensureChannel()
  // The user may have returned to the app while permission/language APIs ran.
  if (isAppActive()) {
    showFeedToast()
    return
  }
  if (nativeNotifications) {
    // Each one keeps its own id, as expo-notifications posts them; 777 is the media notification's.
    nativeId = (nativeId + 1) % 0x7fffffff || 1000
    nativeNotifications.postNotification?.(CHANNEL_ID, t('feeds.notificationTitle'), nativeId, t('feeds.notificationTitle'), body)
    return
  }
  await Notifications?.scheduleNotificationAsync({
    content: {
      title: t('feeds.notificationTitle'),
      body,
      data: { noutubeFeed: true },
    },
    trigger: Platform.OS === 'android' ? { channelId: CHANNEL_ID } : null,
  })
}

let lastResponseId: string | undefined
export function listenFeedNotifications(openFeed: () => void): () => void {
  if (nativeNotifications) {
    if (nativeNotifications.takeFeedNotificationLaunch?.()) openFeed()
    const subscription = nativeNotifications.addListener?.('feedNotificationOpened', openFeed)
    return () => subscription?.remove?.()
  }
  if (!Notifications) return () => {}
  const notifications = Notifications
  let active = true
  const handle = (response: NotificationResponse | null) => {
    if (!active || !response || response.actionIdentifier !== notifications.DEFAULT_ACTION_IDENTIFIER) return
    const { identifier, content } = response.notification.request
    if (content.data?.noutubeFeed !== true || identifier === lastResponseId) return
    lastResponseId = identifier
    openFeed()
    void notifications.clearLastNotificationResponseAsync()
  }
  const subscription = notifications.addNotificationResponseReceivedListener(handle)
  void notifications.getLastNotificationResponseAsync().then(handle).catch((error) => console.error('Feed notification response failed:', error))
  return () => {
    active = false
    subscription.remove()
  }
}
