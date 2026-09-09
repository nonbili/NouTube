import { pushToast } from '@/states/toast'

// iOS has no system toast, so the message goes to the in-app host rendered by
// MainPage (see components/Toast.tsx).
export function showToast(msg: string) {
  pushToast(msg)
}
