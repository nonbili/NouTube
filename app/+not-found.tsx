import { Redirect } from 'expo-router'

export default function NotFound() {
  // A hack to prevent "Unmatched Route" error when using "Open in".
  return <Redirect href="/" />
}
