import { BackHandler, View, useWindowDimensions } from 'react-native'
import { version } from '../../package.json'
import { version as desktopVersion } from '../../desktop/package.json'
import { useCallback, useEffect, useRef } from 'react'
import { isWeb } from '@/lib/utils'
import { useValue } from '@legendapp/state/react'
import { BaseModal } from './BaseModal'
import { ui$ } from '@/states/ui'
import { SettingsTree, type SettingsTreeHandle } from './SettingsTree'
import { SafeAreaView } from 'react-native-safe-area-context'

export const SettingsModal = () => {
  const settingsModalOpen = useValue(ui$.settingsModalOpen)
  const urlModalOpen = useValue(ui$.urlModalOpen)
  const cookieModalOpen = useValue(ui$.cookieModalOpen)
  const userAgentModalOpen = useValue(ui$.userAgentModalOpen)
  const { width } = useWindowDimensions()
  const tree = useRef<SettingsTreeHandle>(null)

  const isNarrowNative = !isWeb && width < 768
  const appVersion = isWeb ? desktopVersion : version

  const closeSettingsChildren = useCallback(() => {
    ui$.sleepTimerModalOpen.set(false)
    ui$.urlModalOpen.set(false)
    ui$.cookieModalOpen.set(false)
    ui$.userAgentModalOpen.set(false)
  }, [])

  const closeSettingsTree = useCallback(() => {
    closeSettingsChildren()
    ui$.settingsModalOpen.set(false)
  }, [closeSettingsChildren])

  const closeTopOverlay = useCallback(() => {
    if (ui$.sleepTimerModalOpen.get()) {
      ui$.sleepTimerModalOpen.set(false)
      return true
    }
    if (userAgentModalOpen) {
      ui$.userAgentModalOpen.set(false)
      return true
    }
    if (cookieModalOpen) {
      ui$.cookieModalOpen.set(false)
      return true
    }
    if (urlModalOpen) {
      ui$.urlModalOpen.set(false)
      return true
    }

    return false
  }, [cookieModalOpen, urlModalOpen, userAgentModalOpen])

  const handleBack = useCallback(() => {
    if (closeTopOverlay()) {
      return true
    }
    if (tree.current?.back()) {
      return true
    }
    closeSettingsTree()
    return true
  }, [closeSettingsTree, closeTopOverlay])

  useEffect(() => {
    if (!settingsModalOpen || isWeb) {
      return
    }

    const subscription = BackHandler.addEventListener('hardwareBackPress', handleBack)
    return () => subscription.remove()
  }, [handleBack, settingsModalOpen])

  useEffect(() => {
    if (!settingsModalOpen || !isWeb || !window.addEventListener) {
      return
    }

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') {
        return
      }
      handleBack()
      e.preventDefault()
      e.stopImmediatePropagation?.()
    }

    window.addEventListener('keyup', onKeyUp, true)
    return () => window.removeEventListener('keyup', onKeyUp, true)
  }, [handleBack, settingsModalOpen])

  if (!settingsModalOpen) {
    return null
  }

  const content = <SettingsTree ref={tree} version={appVersion} onExit={closeSettingsTree} />

  if (isWeb) {
    return (
      <View className="h-full w-[30rem] max-w-[42vw] shrink-0 border-r border-zinc-300 bg-zinc-100 shadow-xl shadow-zinc-900/10 dark:border-zinc-800 dark:bg-zinc-950">
        {content}
      </View>
    )
  }

  return isNarrowNative ? (
    <View className="absolute inset-0 z-10 bg-zinc-100 dark:bg-zinc-950">
      <SafeAreaView className="flex-1" edges={['top']}>
        {content}
      </SafeAreaView>
    </View>
  ) : (
    <BaseModal onClose={closeSettingsTree} className="bg-transparent">
      {content}
    </BaseModal>
  )
}
