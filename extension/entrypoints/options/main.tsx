import 'expo-modules-core-polyfill'
import '@/lib/i18n'
import '../../components/native/global.css'

import { createRoot } from 'react-dom/client'
import { setDynamicLoadingEnabled } from '@react-native-vector-icons/common'
import { App } from './App'

// The icon fonts are declared in global.css; nothing may try to load them
// through the react-native asset registry.
setDynamicLoadingEnabled(false)

createRoot(document.getElementById('root')!).render(<App />)
