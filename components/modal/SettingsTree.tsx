import { Pressable, ScrollView, View, useColorScheme } from 'react-native'
import { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from 'react'
import { clsx, isWeb, nIf } from '@/lib/utils'
import { useValue } from '@legendapp/state/react'
import { auth$ } from '@/states/auth'
import { settings$ } from '@/states/settings'
import { t } from 'i18next'
import { capitalize } from 'es-toolkit'
import MaterialIcons, { type MaterialIconsIconName } from '@react-native-vector-icons/material-icons'
import { queryClient } from '@/lib/query/client'
import { getReleaseFeedQuery } from '@/lib/query/changelog'
import { mainClient } from '@/lib/main-client'
import { showToast } from '@/lib/toast'
import { NouText } from '../NouText'
import { NouLink } from '../link/NouLink'
import { SettingsModalTabSync } from './SettingsModalTabSync'
import {
  SettingsActionRow,
  SettingsAppearanceContent,
  SettingsPreferencesContent,
  SettingsToolsContent,
  SettingsTransferContent,
  SettingsYouTubeContent,
} from './SettingsModalTabSettings'
import { SettingsChangelogContent } from './SettingsModalTabChangelog'
import { SettingsUserStylesContent } from './SettingsUserStylesContent'
import { SettingsBlocklistContent } from './SettingsBlocklistContent'

const repo = 'https://github.com/nonbili/NouTube'
const donateLinks = [
  { label: 'GitHub Sponsors', detail: 'github.com/sponsors/rnons', url: 'https://github.com/sponsors/rnons' },
  { label: 'Liberapay', detail: 'liberapay.com/rnons', url: 'https://liberapay.com/rnons' },
  { label: 'PayPal', detail: 'paypal.me/rnons', url: 'https://paypal.me/rnons' },
]
export const surfaceCls =
  'overflow-hidden rounded-[24px] border border-zinc-300 dark:border-zinc-800 bg-zinc-100/80 dark:bg-zinc-900/70'
export const sectionLabelCls = 'mb-2 px-1 text-[11px] uppercase tracking-[0.18em] text-zinc-600 dark:text-zinc-500'
export const iconWrapCls =
  'h-10 w-10 items-center justify-center rounded-2xl border border-zinc-300 dark:border-zinc-800 bg-zinc-200 dark:bg-zinc-950'

export type SettingsPage =
  | 'home'
  | 'content'
  | 'preferences'
  | 'appearance'
  | 'blocklist'
  | 'styles'
  | 'tools'
  | 'transfer'
  | 'sync'
  | 'about'
  | 'changelog'

export const SettingsSection: React.FC<React.PropsWithChildren<{ label?: string }>> = ({ label, children }) => {
  return (
    <View>
      {label ? <NouText className={sectionLabelCls}>{label}</NouText> : null}
      {children}
    </View>
  )
}

export const SettingsNavRow: React.FC<{
  title: string
  description: string
  icon: MaterialIconsIconName
  meta?: string
  onPress: () => void
  isLast?: boolean
}> = ({ title, description, icon, meta, onPress, isLast = false }) => {
  const colorScheme = useColorScheme()
  const isDark = colorScheme !== 'light'
  return (
    <Pressable
      onPress={onPress}
      className={clsx(
        'flex-row items-center gap-3 px-4 py-4 active:bg-zinc-200/80 dark:active:bg-zinc-800/80',
        !isLast && 'border-b border-zinc-300 dark:border-zinc-800',
      )}
    >
      <View className={iconWrapCls}>
        <MaterialIcons name={icon} color={isDark ? '#d4d4d8' : '#475569'} size={18} />
      </View>
      <View className="flex-1">
        <View className="flex-row items-center gap-2">
          <NouText className="flex-1 font-medium">{title}</NouText>
          {meta ? (
            <NouText className="text-xs uppercase tracking-[0.16em] text-zinc-600 dark:text-zinc-500">{meta}</NouText>
          ) : null}
        </View>
        <NouText className="mt-1 text-sm leading-5 text-zinc-600 dark:text-zinc-400">{description}</NouText>
      </View>
      <MaterialIcons name="chevron-right" color={isDark ? '#71717a' : '#52525b'} size={20} />
    </Pressable>
  )
}

export const SettingsExternalRow: React.FC<{
  title: string
  detail: string
  href: string
  icon?: MaterialIconsIconName
  isLast?: boolean
}> = ({ title, detail, href, icon = 'open-in-new', isLast = false }) => {
  const colorScheme = useColorScheme()
  const isDark = colorScheme !== 'light'
  return (
    <NouLink href={href}>
      <View
        className={clsx(
          'flex-row items-center gap-3 px-4 py-4',
          !isLast && 'border-b border-zinc-300 dark:border-zinc-800',
        )}
      >
        <View className={iconWrapCls}>
          <MaterialIcons name={icon} color={isDark ? '#d4d4d8' : '#475569'} size={18} />
        </View>
        <View className="flex-1">
          <NouText className="font-medium">{title}</NouText>
          <NouText className="mt-1 text-sm leading-5 text-zinc-600 dark:text-zinc-400">{detail}</NouText>
        </View>
        <MaterialIcons name="chevron-right" color={isDark ? '#71717a' : '#52525b'} size={20} />
      </View>
    </NouLink>
  )
}

function formatPlanLabel(plan?: string) {
  return plan ? capitalize(plan) : 'Free'
}

export interface SettingsTreeHandle {
  /* Pops one page, or reports that the tree is already at its root and the
   * host has to decide what a back press means. */
  back: () => boolean
}

/*
 * The settings pages and the stack that walks between them, with no opinion on
 * what contains them: the app mounts this inside SettingsModal, the browser
 * extension mounts it as its options page.
 */
export const SettingsTree = forwardRef<
  SettingsTreeHandle,
  {
    version: string
    /* Rendered at the root, where there is no page to go back to. A page that
     * is nothing but settings has nowhere to go, and passes nothing. */
    onExit?: () => void
    /* Signing in is the one thing a host can own: the browser extension goes
     * through its background rather than the web login this page links to. */
    renderSync?: () => React.ReactNode
    /* Downloads, cookies, proxy and other shell-owned tools do not have an
     * extension counterpart. */
    showShellTools?: boolean
  }
>(({ version, onExit, renderSync, showShellTools = true }, ref) => {
  const theme = useValue(settings$.theme)
  const { user, plan } = useValue(auth$)
  const colorScheme = useColorScheme()
  const isDark = colorScheme !== 'light'
  const [pageStack, setPageStack] = useState<SettingsPage[]>(['home'])
  const [importingList, setImportingList] = useState(false)
  const [importingTakeout, setImportingTakeout] = useState(false)
  const [updateSupported, setUpdateSupported] = useState(false)
  const [checkingUpdate, setCheckingUpdate] = useState(false)

  const currentPage = pageStack[pageStack.length - 1]
  const canGoBack = pageStack.length > 1
  const themeLabel =
    theme === 'dark'
      ? t('settings.theme.dark')
      : theme === 'light'
        ? t('settings.theme.light')
        : t('settings.theme.system')

  useEffect(() => {
    void queryClient.prefetchQuery(getReleaseFeedQuery())
  }, [])

  useEffect(() => {
    let active = true
    mainClient
      .isUpdateSupported()
      .then((supported) => {
        if (active) setUpdateSupported(supported)
      })
      .catch(() => {
        if (active) setUpdateSupported(false)
      })
    return () => {
      active = false
    }
  }, [])

  const pushPage = useCallback((page: SettingsPage) => {
    setPageStack((stack) => (stack[stack.length - 1] === page ? stack : stack.concat(page)))
  }, [])

  const popPage = useCallback(() => {
    setPageStack((stack) => (stack.length > 1 ? stack.slice(0, -1) : stack))
  }, [])

  useImperativeHandle(
    ref,
    () => ({
      back: () => {
        if (pageStack.length <= 1) {
          return false
        }
        popPage()
        return true
      },
    }),
    [pageStack.length, popPage],
  )

  const handleCheckForUpdate = useCallback(async () => {
    setCheckingUpdate(true)
    try {
      const result = await mainClient.checkForUpdate()
      if (result.status === 'available') {
        showToast(t('update.downloading', { version: result.version }))
      } else if (result.status === 'error') {
        showToast(result.message || t('update.error'))
      } else {
        showToast(t('update.upToDate'))
      }
    } catch (e: any) {
      console.error('checkForUpdate failed', e)
      showToast(e.message || t('update.error'))
    } finally {
      setCheckingUpdate(false)
    }
  }, [])

  const pageMeta = {
    home: { title: t('settings.label') },
    content: { title: t('settings.preferences') },
    preferences: { title: t('settings.preferences') },
    appearance: { title: t('settings.appearance') },
    blocklist: { title: t('settings.blocklist.label') },
    styles: { title: t('settings.userStyles.label') },
    tools: { title: t('settings.tools') },
    transfer: { title: t('settings.transfer') },
    sync: { title: t('sync.label') },
    about: { title: t('about.label') },
    changelog: { title: t('changelog.label') },
  } satisfies Record<SettingsPage, { title: string }>

  const renderPage = () => {
    switch (currentPage) {
      case 'home':
        return (
          <View className="gap-8">
            <SettingsSection label={t('settings.groupYouTube')}>
              <View className={surfaceCls}>
                <SettingsNavRow
                  title={t('settings.preferences')}
                  description={t('settings.preferencesYouTubeHint')}
                  icon="tune"
                  onPress={() => pushPage('content')}
                />
                <SettingsNavRow
                  title={t('settings.blocklist.label')}
                  description={t('settings.blocklist.hint')}
                  icon="block"
                  onPress={() => pushPage('blocklist')}
                />
                <SettingsNavRow
                  title={t('settings.userStyles.label')}
                  description={t('settings.userStyles.hint')}
                  icon="brush"
                  onPress={() => pushPage('styles')}
                  isLast
                />
              </View>
            </SettingsSection>

            <SettingsSection label={t('settings.groupNouTube')}>
              <View className={surfaceCls}>
                <SettingsNavRow
                  title={t('settings.preferences')}
                  description={t('settings.preferencesNouTubeHint')}
                  icon="toggle-on"
                  onPress={() => pushPage('preferences')}
                />
                <SettingsNavRow
                  title={t('settings.appearance')}
                  description={t('settings.appearanceHint')}
                  icon="palette"
                  meta={themeLabel}
                  onPress={() => pushPage('appearance')}
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
                  isLast={!showShellTools}
                />
                {nIf(
                  showShellTools,
                  <SettingsNavRow
                    title={t('settings.tools')}
                    description={t('settings.toolsHint')}
                    icon="build"
                    onPress={() => pushPage('tools')}
                    isLast
                  />,
                )}
              </View>
            </SettingsSection>

            <SettingsSection label={t('about.label')}>
              <View className={surfaceCls}>
                <SettingsNavRow
                  title={t('about.label')}
                  description={t('about.hint')}
                  icon="info-outline"
                  meta={`v${version}`}
                  onPress={() => pushPage('about')}
                />
                <SettingsNavRow
                  title={t('changelog.label')}
                  description={t('changelog.hint')}
                  icon="history"
                  onPress={() => pushPage('changelog')}
                  isLast
                />
              </View>
            </SettingsSection>
          </View>
        )

      case 'content':
        return <SettingsYouTubeContent />

      case 'preferences':
        return <SettingsPreferencesContent />

      case 'appearance':
        return <SettingsAppearanceContent />

      case 'blocklist':
        return <SettingsBlocklistContent />

      case 'styles':
        return <SettingsUserStylesContent />

      case 'tools':
        return <SettingsToolsContent />

      case 'transfer':
        return (
          <SettingsTransferContent
            importingList={importingList}
            setImportingList={setImportingList}
            importingTakeout={importingTakeout}
            setImportingTakeout={setImportingTakeout}
          />
        )

      case 'sync':
        return renderSync ? renderSync() : <SettingsModalTabSync />

      case 'changelog':
        return <SettingsChangelogContent />

      case 'about':
        return (
          <View className="gap-6">
            <View className="rounded-[28px] border border-zinc-300 dark:border-zinc-800 bg-zinc-100/80 dark:bg-zinc-900/80 px-5 py-5">
              <NouText className="text-[11px] uppercase tracking-[0.18em] text-zinc-600 dark:text-zinc-500">
                NouTube
              </NouText>
              <NouText className="mt-2 text-xl font-semibold tracking-tight">v{version}</NouText>
            </View>

            {updateSupported ? (
              <SettingsSection label={t('about.updates')}>
                <View className={surfaceCls}>
                  <SettingsActionRow
                    label={t('update.check')}
                    description={t('update.checkHint')}
                    icon="system-update"
                    onPress={handleCheckForUpdate}
                    loading={checkingUpdate}
                    isLast
                  />
                </View>
              </SettingsSection>
            ) : null}

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

      default: {
        // Adding a SettingsPage without a case here is a compile error rather than a blank page.
        const unhandled: never = currentPage
        return unhandled
      }
    }
  }

  const showBackButton = canGoBack || Boolean(onExit)

  return (
    <View className="flex-1 bg-zinc-100 dark:bg-zinc-950">
      <View className="border-b border-zinc-300 dark:border-zinc-800 px-3 py-3">
        <View className="flex-row items-center gap-2">
          {showBackButton ? (
            <Pressable
              onPress={() => {
                if (canGoBack) {
                  popPage()
                  return
                }
                onExit?.()
              }}
              className="h-11 w-11 items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-900"
            >
              <MaterialIcons name={canGoBack ? 'arrow-back' : 'close'} color={isDark ? 'white' : '#111827'} size={22} />
            </Pressable>
          ) : null}
          <View className="flex-1">
            <NouText className="text-lg font-semibold">{pageMeta[currentPage].title}</NouText>
          </View>
        </View>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className={clsx('px-4 py-5', isWeb && 'mx-auto w-full max-w-3xl')}>
          {renderPage()}
          <View className="h-16" />
        </View>
      </ScrollView>
    </View>
  )
})

SettingsTree.displayName = 'SettingsTree'
