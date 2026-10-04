import type { FeedNotificationUpdate } from './feed-notification-videos'

// Feed background notifications are available on mobile only.
export async function setFeedNotificationsEnabled(_enabled: boolean): Promise<boolean> {
  return false
}
export async function syncFeedNotificationTask(): Promise<boolean> { return false }
export async function notifyFeedVideos(_updates: FeedNotificationUpdate[]): Promise<void> {}
export function listenFeedNotifications(_openFeed: () => void): () => void {
  return () => {}
}
