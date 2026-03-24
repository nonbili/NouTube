import { BackHandler, Pressable, ScrollView, View, useWindowDimensions } from 'react-native'
import { NouText } from '../NouText'
import { NouLink } from '../link/NouLink'
import { version } from '../../package.json'
import { version as desktopVersion } from '../../desktop/package.json'
import { useCallback, useEffect, useState } from 'react'
import { clsx, isWeb } from '@/lib/utils'
import { useValue } from '@legendapp/state/react'
import { BaseModal } from './BaseModal'
import { ui$ } from '@/states/ui'
import { SettingsModalTabSync } from './SettingsModalTabSync'
import {
  SettingsAppearanceContent,
  SettingsPreferencesContent,
  SettingsToolsContent,
  SettingsTransferContent,
} from './SettingsModalTabSettings'
import { SettingsUserStylesContent } from './SettingsUserStylesContent'
import { t } from 'i18next'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { auth$ } from '@/states/auth'
import { capitalize } from 'es-toolkit'
import { settings$ } from '@/states/settings'
import { SafeAreaView } from 'react-native-safe-area-context'

const repo = 'https://github.com/nonbili/NouTube'
const donateLinks = [
  { label: 'GitHub Sponsors', detail: 'github.com/sponsors/rnons', url: 'https://github.com/sponsors/rnons' },
  { label: 'Liberapay', detail: 'liberapay.com/rnons', url: 'https://liberapay.com/rnons' },
  { label: 'PayPal', detail: 'paypal.me/rnons', url: 'https://paypal.me/rnons' },
]
const surfaceCls = 'overflow-hidden rounded-[24px] border border-zinc-800 bg-zinc-900/70'
const sectionLabelCls = 'mb-2 px-1 text-[11px] uppercase tracking-[0.18em] text-zinc-500'
const iconWrapCls = 'h-10 w-10 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950'

type SettingsPage = 'home' | 'preferences' | 'appearance' | 'styles' | 'tools' | 'transfer' | 'sync' | 'about'



const SettingsSection: React.FC<React.PropsWithChildren<{ label?: string }>> = ({ label, children }) => {
  return (
    <View>
      {label ? <NouText className={sectionLabelCls}>{label}</NouText> : null}
      {children}
    </View>
  )
}

const SettingsNavRow: React.FC<{
  title: string
  description: string
  icon: keyof typeof MaterialIcons.glyphMap
  meta?: string
  onPress: () => void
  isLast?: boolean
}> = ({ title, description, icon, meta, onPress, isLast = false }) => {
  return (
    <Pressable
      onPress={onPress}
      className={clsx('flex-row items-center gap-3 px-4 py-4 active:bg-zinc-800/80', !isLast && 'border-b border-zinc-800')}
    >
      <View className={iconWrapCls}>
        <MaterialIcons name={icon} color="#d4d4d8" size={18} />
      </View>
      <View className="flex-1">
        <View className="flex-row items-center gap-2">
          <NouText className="flex-1 font-medium">{title}</NouText>
          {meta ? <NouText className="text-xs uppercase tracking-[0.16em] text-zinc-500">{meta}</NouText> : null}
        </View>
        <NouText className="mt-1 text-sm leading-5 text-zinc-400">{description}</NouText>
      </View>
      <MaterialIcons name="chevron-right" color="#71717a" size={20} />
    </Pressable>
  )
}

const SettingsExternalRow: React.FC<{
  title: string
  detail: string
  href: string
  icon?: keyof typeof MaterialIcons.glyphMap
  isLast?: boolean
}> = ({ title, detail, href, icon = 'open-in-new', isLast = false }) => {
  return (
    <NouLink href={href}>
      <View className={clsx('flex-row items-center gap-3 px-4 py-4', !isLast && 'border-b border-zinc-800')}>
        <View className={iconWrapCls}>
          <MaterialIcons name={icon} color="#d4d4d8" size={18} />
        </View>
        <View className="flex-1">
          <NouText className="font-medium">{title}</NouText>
          <NouText className="mt-1 text-sm leading-5 text-zinc-400">{detail}</NouText>
        </View>
        <MaterialIcons name="chevron-right" color="#71717a" size={20} />
      </View>
    </NouLink>
  )
}

function formatPlanLabel(plan?: string) {
  return plan ? capitalize(plan) : 'Free'
}

export const SettingsModal = () => {
  const settingsModalOpen = useValue(ui$.settingsModalOpen)
  const urlModalOpen = useValue(ui$.urlModalOpen)
  const cookieModalOpen = useValue(ui$.cookieModalOpen)
  const userAgentModalOpen = useValue(ui$.userAgentModalOpen)
  const theme = useValue(settings$.theme)
  const { user, plan } = useValue(auth$)
  const { width } = useWindowDimensions()
  const [pageStack, setPageStack] = useState<SettingsPage[]>(['home'])

  const isNarrowNative = !isWeb && width < 768

  useEffect(() => {
    if (!settingsModalOpen) {
      setPageStack(['home'])
    }
  }, [settingsModalOpen])

  const closeSettingsChildren = useCallback(() => {
    ui$.urlModalOpen.set(false)
    ui$.cookieModalOpen.set(false)
    ui$.userAgentModalOpen.set(false)
  }, [])

  const closeSettingsTree = useCallback(() => {
    closeSettingsChildren()
    ui$.settingsModalOpen.set(false)
  }, [closeSettingsChildren])

  const closeTopOverlay = useCallback(() => {
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

  const currentPage = pageStack[pageStack.length - 1]
  const canGoBack = pageStack.length > 1
  const appVersion = isWeb ? desktopVersion : version
  const themeLabel =
    theme === 'dark' ? t('settings.theme.dark') : theme === 'light' ? t('settings.theme.light') : t('settings.theme.system')

  const pushPage = useCallback((page: SettingsPage) => {
    setPageStack((stack) => (stack[stack.length - 1] === page ? stack : stack.concat(page)))
  }, [])

  const popPage = useCallback(() => {
    setPageStack((stack) => (stack.length > 1 ? stack.slice(0, -1) : stack))
  }, [])

  const handleBack = useCallback(() => {
    if (closeTopOverlay()) {
      return true
    }
    if (canGoBack) {
      popPage()
      return true
    }
    closeSettingsTree()
    return true
  }, [canGoBack, closeSettingsTree, closeTopOverlay, popPage])

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

  const pageMeta = {
    home: { title: t('settings.label') },
    preferences: { title: t('settings.preferences') },
    appearance: { title: t('settings.appearance') },
    styles: { title: t('settings.userStyles.label') },
    tools: { title: t('settings.tools') },
    transfer: { title: t('settings.transfer') },
    sync: { title: t('sync.label') },
    about: { title: t('about.label') },
  } satisfies Record<SettingsPage, { title: string }>

  const renderPage = () => {
    if (currentPage === 'home') {
      return (
        <View className="gap-8">
          <SettingsSection label={t('settings.general')}>
            <View className={surfaceCls}>
              <SettingsNavRow
                title={t('settings.preferences')}
                description={t('settings.preferencesHint')}
                icon="toggle-on"
                onPress={() => pushPage('preferences')}
                isLast={isWeb}
              />
              {!isWeb ? (
                <SettingsNavRow
                  title={t('settings.appearance')}
                  description={t('settings.appearanceHint')}
                  icon="palette"
                  meta={themeLabel}
                  onPress={() => pushPage('appearance')}
                />
              ) : null}
              <SettingsNavRow
                title={t('settings.userStyles.label')}
                description={t('settings.userStyles.hint')}
                icon="brush"
                onPress={() => pushPage('styles')}
                isLast
              />
            </View>
          </SettingsSection>

          <SettingsSection label={t('settings.tools')}>
            <View className={surfaceCls}>
              <SettingsNavRow
                title={t('sync.label')}
                description={user?.email || t('settings.syncHintShort')}
                icon="sync"
                meta={formatPlanLabel(plan)}
                onPress={() => pushPage('sync')}
              />
              <SettingsNavRow
                title={t('settings.transfer')}
                description={t('settings.transferHint')}
                icon="import-export"
                onPress={() => pushPage('transfer')}
              />
              <SettingsNavRow
                title={t('settings.tools')}
                description={t('settings.toolsHint')}
                icon="build"
                onPress={() => pushPage('tools')}
                isLast
              />
            </View>
          </SettingsSection>

          <SettingsSection label={t('about.label')}>
            <View className={surfaceCls}>
              <SettingsNavRow
                title={t('about.label')}
                description={t('about.hint')}
                icon="info-outline"
                meta={`v${appVersion}`}
                onPress={() => pushPage('about')}
                isLast
              />
            </View>
          </SettingsSection>
        </View>
      )
    }

    if (currentPage === 'preferences') {
      return <SettingsPreferencesContent />
    }

    if (currentPage === 'appearance') {
      return <SettingsAppearanceContent />
    }

    if (currentPage === 'styles') {
      return <SettingsUserStylesContent />
    }

    if (currentPage === 'tools') {
      return <SettingsToolsContent />
    }

    if (currentPage === 'transfer') {
      return <SettingsTransferContent />
    }

    if (currentPage === 'sync') {
      return <SettingsModalTabSync />
    }

    return (
      <View className="gap-6">
        <View className="rounded-[28px] border border-zinc-800 bg-zinc-900/80 px-5 py-5">
          <NouText className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">NouTube</NouText>
          <NouText className="mt-2 text-xl font-semibold tracking-tight">v{appVersion}</NouText>
        </View>

        <SettingsSection label={t('about.code')}>
          <View className={surfaceCls}>
            <SettingsExternalRow title="GitHub" detail="github.com/nonbili/NouTube" href={repo} icon="code" isLast />
          </View>
        </SettingsSection>

        <SettingsSection label={t('about.donate')}>
          <View className={surfaceCls}>
            {donateLinks.map((item, index) => (
              <SettingsExternalRow
                key={item.url}
                title={item.label}
                detail={item.detail}
                href={item.url}
                isLast={index === donateLinks.length - 1}
              />
            ))}
          </View>
        </SettingsSection>
      </View>
    )
  }

  if (!settingsModalOpen) {
    return null
  }

  const content = (
    <View className="flex-1 bg-zinc-950">
      <View className="border-b border-zinc-800 px-3 py-3">
        <View className="flex-row items-center gap-2">
          <Pressable onPress={handleBack} className="h-11 w-11 items-center justify-center rounded-full bg-zinc-900">
            <MaterialIcons name={canGoBack ? 'arrow-back' : 'close'} color="white" size={22} />
          </Pressable>
          <View className="flex-1">
            <NouText className="text-lg font-semibold">{pageMeta[currentPage].title}</NouText>
          </View>
        </View>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="px-4 py-5">
          {renderPage()}
          <View className="h-16" />
        </View>
      </ScrollView>
    </View>
  )

  return isNarrowNative ? (
    <View className="absolute inset-0 z-10 bg-zinc-950">
      <SafeAreaView className="flex-1" edges={['top']}>
        {content}
      </SafeAreaView>
    </View>
  ) : (
    <BaseModal onClose={closeSettingsTree} useEscape={false} className="bg-transparent">
      {content}
    </BaseModal>
  )
}
