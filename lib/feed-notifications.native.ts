import * as BackgroundTask from 'expo-background-task'
import * as TaskManager from 'expo-task-manager'
import * as Notifications from 'expo-notifications'
import { syncState, when } from '@legendapp/state'
import { AppState, Platform } from 'react-native'
import { changeLanguage, t } from 'i18next'
import { getLocales } from 'expo-localization'
import { resolveI18nLanguageFromExpoLocale } from './i18n'
import { syncNativeSettings } from './native-settings'
import type { FeedNotificationUpdate } from './feed-notification-videos'
import { settings$ } from '@/states/settings'

const TASK_NAME = 'noutube-feed-notifications'
const CHANNEL_ID = 'feed-videos'
const isAppActive = () => AppState.currentState === 'active'

Notifications.setNotificationHandler({
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
  if (Platform.OS === 'android') {
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
    if (settings$.feedNotificationsEnabled.get()) {
      const permitted = (await Notifications.getPermissionsAsync()).granted
      if (!permitted) {
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
  if (enabled) {
    if ((await BackgroundTask.getStatusAsync()) !== BackgroundTask.BackgroundTaskStatus.Available) return false
    await applyNotificationLanguage()
    await ensureChannel()
    const permission = await Notifications.requestPermissionsAsync()
    if (!permission.granted) return false
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
  if (!(await syncFeedNotificationTask()) || isAppActive()) return
  await applyNotificationLanguage()
  await ensureChannel()
  // The user may have returned to the app while permission/language APIs ran.
  if (isAppActive()) return
  await Notifications.scheduleNotificationAsync({
    content: {
      title: t('feeds.notificationTitle'),
      body: updates.length === 1
        ? t('feeds.notificationBody', { count, channel: updates[0].channel })
        : t('feeds.notificationSummary', { count, channels: updates.length }),
      data: { noutubeFeed: true },
    },
    trigger: Platform.OS === 'android' ? { channelId: CHANNEL_ID } : null,
  })
}

let lastResponseId: string | undefined
export function listenFeedNotifications(openFeed: () => void): () => void {
  let active = true
  const handle = (response: Notifications.NotificationResponse | null) => {
    if (!active || !response || response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return
    const { identifier, content } = response.notification.request
    if (content.data?.noutubeFeed !== true || identifier === lastResponseId) return
    lastResponseId = identifier
    openFeed()
    void Notifications.clearLastNotificationResponseAsync()
  }
  const subscription = Notifications.addNotificationResponseReceivedListener(handle)
  void Notifications.getLastNotificationResponseAsync().then(handle).catch((error) => console.error('Feed notification response failed:', error))
  return () => {
    active = false
    subscription.remove()
  }
}
