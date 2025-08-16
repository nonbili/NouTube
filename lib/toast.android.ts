import { ToastAndroid } from 'react-native'

export function showToast(msg: string) {
  ToastAndroid.show(msg, ToastAndroid.SHORT)
}
