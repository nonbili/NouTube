import { Alert } from 'react-native'
import { isWeb } from './utils'

export function showConfirm(title: string, message: string, onOk: () => void) {
  if (isWeb) {
    if (window.confirm(`${title}\n\n${message}`)) {
      onOk()
    }
    return
  }

  Alert.alert(title, message, [
    {
      text: 'Cancel',
      onPress: () => {},
      style: 'cancel',
    },
    {
      text: 'Yes',
      onPress: onOk,
      style: 'default',
    },
  ])
}
