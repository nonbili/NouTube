import { ActivityIndicator, Pressable, ScrollView, TextInput, View, useColorScheme } from 'react-native'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useValue } from '@legendapp/state/react'
import { ui$ } from '@/states/ui'
import { settings$ } from '@/states/settings'
import { BaseModal } from './BaseModal'
import { NouText } from '../NouText'
import { NouButton } from '../button/NouButton'
import { NouSwitch } from '../switch/NouSwitch'
import { mainClient } from '@/lib/main-client'
import { downloads$ } from '@/states/downloads'
import { t } from 'i18next'
import type { FormatOption } from '@/lib/main-client'
import { findPinnedFormats, togglePinnedFormat } from '@/lib/download-format'
import { isAndroid, nIf } from '@/lib/utils'
import MaterialIcons from '@react-native-vector-icons/material-icons'

type Phase = 'idle' | 'loading' | 'choosing' | 'error'

export const ToolsModal = () => {
  const toolsModalOpen = useValue(ui$.toolsModalOpen)
  const toolsModalUrl = useValue(ui$.toolsModalUrl)
  const isOpen = toolsModalOpen || !!toolsModalUrl
  const downloadPath = useValue(settings$.downloadPath)
  const useCookies = useValue(settings$.downloadUseCookies)
  const downloadPresets = useValue(settings$.downloadPresets)
  const [url, setUrl] = useState('')
  const [resolvedDownloadsPath, setResolvedDownloadsPath] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [formats, setFormats] = useState<FormatOption[]>([])
  const [parsedTitle, setParsedTitle] = useState('')
  const [loadedUrl, setLoadedUrl] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [showAllFormats, setShowAllFormats] = useState(false)
  const activeDownloads = useValue(downloads$)
  const loadingUrlRef = useRef('')
  const scrollRef = useRef<ScrollView>(null)
  const downloadsSectionYRef = useRef(0)
  const scrollToDownloadsRef = useRef(false)
  const isDark = useColorScheme() !== 'light'
  const effectiveDownloadPath = downloadPath || resolvedDownloadsPath

  const onClose = () => {
    ui$.toolsModalOpen.set(false)
    ui$.toolsModalUrl.set('')
  }

  const loadFormats = useCallback((targetUrl: string) => {
    loadingUrlRef.current = targetUrl
    setPhase('loading')
    setFormats([])
    setShowAllFormats(false)
    setParsedTitle('')
    setLoadedUrl('')
    setErrorMsg('')
    mainClient
      .listFormats(targetUrl, settings$.downloadUseCookies.peek())
      .then((result) => {
        if (loadingUrlRef.current !== targetUrl) return
        setFormats(result.formats)
        setParsedTitle(result.title)
        setLoadedUrl(targetUrl)
        setPhase('choosing')
      })
      .catch((err: any) => {
        if (loadingUrlRef.current !== targetUrl) return
        setErrorMsg(err?.message || t('modals.failedToLoadFormats'))
        setPhase('error')
      })
  }, [])

  useEffect(() => {
    mainClient.getDownloadsPath().then(setResolvedDownloadsPath)
  }, [])

  useEffect(() => {
    if (!isOpen) return
    if (toolsModalUrl) {
      setUrl(toolsModalUrl)
      loadFormats(toolsModalUrl)
    } else {
      setUrl('')
      setPhase('idle')
    }
    setFormats([])
  }, [isOpen, toolsModalUrl, loadFormats])

  const openSavedFile = (savedPath: string) => {
    Promise.resolve(mainClient.openFile(savedPath)).catch((err: any) => {
      console.error('failed to open file', err)
    })
  }

  // The format list stays up after a download starts, so another format of the same video can
  // be grabbed without resolving the URL again.
  const handleDownload = (formatId: string) => {
    const targetUrl = loadedUrl || toolsModalUrl || url
    downloads$[targetUrl].set({
      url: targetUrl,
      title: parsedTitle || targetUrl,
      phase: 'downloading',
      progress: 0,
      progressLine: '',
      errorMsg: '',
      savedPath: '',
    })

    // The progress card sits above the format list, which can be long enough that the card is
    // off screen when a format further down was picked — so scroll it into view. On the first
    // download the section is not laid out yet, hence the flag picked up by its onLayout.
    if (downloadsSectionYRef.current) {
      scrollToDownloads()
    } else {
      scrollToDownloadsRef.current = true
    }

    mainClient.downloadVideo(targetUrl, formatId, effectiveDownloadPath, useCookies).catch(() => {
      // handled via downloadProgress done+error
    })
  }

  const scrollToDownloads = () => {
    scrollRef.current?.scrollTo({ y: Math.max(0, downloadsSectionYRef.current - 12), animated: true })
  }

  if (!isOpen) return null

  const hasAdvancedFormats = formats.some((opt) => opt.advanced)
  const presets = Array.isArray(downloadPresets) ? downloadPresets : []
  const pinnedFormats = findPinnedFormats(formats, presets)
  const pinnedByFormatId = new Map(pinnedFormats.map((pinned) => [pinned.format.formatId, pinned]))
  const listedFormats = showAllFormats ? formats : formats.filter((opt) => !opt.advanced)
  // Pinned formats lead the list even when they are extra formats, so pins remove the need to
  // expand the list at all.
  const visibleFormats = [
    ...pinnedFormats.map((pinned) => pinned.format),
    ...listedFormats.filter((opt) => !pinnedByFormatId.has(opt.formatId)),
  ]

  // Downloads are tracked per URL, so a second format of the same video would take over the
  // progress of the running one — one at a time per video.
  const isDownloadingCurrent = activeDownloads[loadedUrl]?.phase === 'downloading'

  const togglePin = (opt: FormatOption) => {
    settings$.downloadPresets.set(togglePinnedFormat(presets, opt, pinnedByFormatId.get(opt.formatId)))
  }

  const activeDownloadUrls = Object.keys(activeDownloads).reverse()
  const getProgressValue = (value: number) => Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0))

  return (
    <BaseModal onClose={onClose}>
      <ScrollView
        ref={scrollRef}
        className="flex-1"
        contentContainerClassName="p-5 gap-4"
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex-row items-center justify-between">
          <NouText className="text-lg font-semibold">{t('modals.downloadVideo', 'Download video')}</NouText>
        </View>

        <View className="gap-1">
          <NouText className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">URL</NouText>
          <TextInput
            className="rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-2 text-sm text-zinc-900 dark:text-zinc-100"
            value={url}
            onChangeText={(v) => {
              setUrl(v)
              setPhase('idle')
              setFormats([])
            }}
            onSubmitEditing={() => {
              const trimmed = url.trim()
              if (trimmed) loadFormats(trimmed)
            }}
            returnKeyType="go"
            placeholder="https://www.youtube.com/watch?v=..."
            placeholderTextColor={isDark ? '#71717a' : '#a1a1aa'}
          />
        </View>

        {nIf(
          !isAndroid && (phase === 'idle' || phase === 'choosing'),
          <View className="gap-1">
            <NouText className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">{t('modals.folder')}</NouText>
            <Pressable
              className="flex-row items-center gap-2 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-2 active:bg-zinc-100 dark:active:bg-zinc-800"
              onPress={async () => {
                const picked = await mainClient.selectFolder()
                if (picked) settings$.downloadPath.set(picked)
              }}
            >
              <NouText className="flex-1 text-sm text-zinc-700 dark:text-zinc-300" numberOfLines={1}>
                {effectiveDownloadPath || t('modals.downloadsFolder')}
              </NouText>
              <NouText className="text-xs text-zinc-400 dark:text-zinc-500">{t('buttons.browse')}</NouText>
            </Pressable>
          </View>,
        )}

        {nIf(
          phase === 'idle' || phase === 'choosing' || phase === 'error',
          <View className="gap-1">
            <NouSwitch
              label={t('modals.downloadUseCookies')}
              value={useCookies}
              onPress={() => settings$.downloadUseCookies.set(!settings$.downloadUseCookies.peek())}
            />
            <NouText className="text-xs text-zinc-500 dark:text-zinc-400">
              {t('modals.downloadUseCookiesHint')}
            </NouText>
          </View>,
        )}

        {nIf(
          phase === 'idle' || phase === 'error',
          <View className="flex-row justify-end">
            <NouButton disabled={!url.trim()} onPress={() => loadFormats(url.trim())}>
              {t('buttons.next')}
            </NouButton>
          </View>,
        )}

        {activeDownloadUrls.length > 0 && (
          <View
            className="gap-4"
            onLayout={(e) => {
              downloadsSectionYRef.current = e.nativeEvent.layout.y
              if (scrollToDownloadsRef.current) {
                scrollToDownloadsRef.current = false
                scrollToDownloads()
              }
            }}
          >
            <View className="flex-row items-center justify-between">
              <NouText className="text-sm font-bold uppercase tracking-widest text-zinc-500">
                {t('modals.downloadHistory')}
              </NouText>
              <Pressable
                onPress={() => {
                  downloads$.set({})
                }}
                className="px-2 py-1 rounded-md active:bg-zinc-200 dark:active:bg-zinc-800"
              >
                <NouText className="text-xs text-zinc-500 font-medium">{t('buttons.clearAll')}</NouText>
              </Pressable>
            </View>
            {activeDownloadUrls.map((dUrl) => {
              const d = activeDownloads[dUrl]
              return (
                <View
                  key={dUrl}
                  className={
                    d.phase === 'done'
                      ? 'rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900 p-4 gap-2'
                      : d.phase === 'error'
                        ? 'rounded-xl border border-red-300 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-4 gap-2'
                        : 'rounded-xl border border-sky-200 dark:border-sky-900 bg-sky-50/70 dark:bg-sky-950/30 p-4 gap-2'
                  }
                >
                  <View className="flex-row items-start justify-between gap-3">
                    <Pressable
                      className="flex-1 gap-1"
                      disabled={d.phase !== 'done' || !d.savedPath}
                      onPress={() => openSavedFile(d.savedPath)}
                    >
                      <NouText className="text-sm font-semibold text-zinc-900 dark:text-zinc-100" numberOfLines={2}>
                        {d.title || dUrl}
                      </NouText>
                    </Pressable>
                    {nIf(
                      d.phase === 'error',
                      <MaterialIcons name="error-outline" size={18} color={isDark ? '#f87171' : '#dc2626'} />,
                    )}
                    {nIf(
                      d.phase === 'downloading',
                      <ActivityIndicator size="small" color={isDark ? '#7dd3fc' : '#0284c7'} />,
                    )}
                  </View>
                  {d.phase === 'downloading' && (
                    <View className="h-2 overflow-hidden rounded-full bg-sky-100 dark:bg-sky-950">
                      <View
                        className="h-full rounded-full bg-sky-500 dark:bg-sky-400"
                        style={{ width: `${Math.max(2, getProgressValue(d.progress))}%` }}
                      />
                    </View>
                  )}
                  {d.phase === 'downloading' && (
                    <NouText className="text-sm text-sky-700 dark:text-sky-200 font-mono" numberOfLines={2}>
                      {d.progressLine || t('modals.starting')}
                    </NouText>
                  )}
                  {d.phase === 'done' && (
                    <View className="gap-2">
                      <View className="mt-1 flex-row items-center gap-2">
                        <View className="flex-1 shrink flex-row items-center gap-2 mr-auto">
                          <MaterialIcons name="check-circle" size={18} color={isDark ? '#86efac' : '#16a34a'} />
                          <NouText className="flex-1 text-xs text-zinc-500 dark:text-zinc-400" numberOfLines={2}>
                            {isAndroid ? 'Saved to the Downloads folder' : t('modals.downloadComplete')}
                          </NouText>
                        </View>
                        {!!d.savedPath && (
                          <Pressable
                            onPress={() => openSavedFile(d.savedPath)}
                            className="bg-zinc-200 dark:bg-zinc-800 px-3 py-1.5 rounded-lg active:bg-zinc-300 dark:active:bg-zinc-700"
                          >
                            <NouText className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                              {t('buttons.open')}
                            </NouText>
                          </Pressable>
                        )}
                        {!!d.savedPath && !isAndroid && (
                          <Pressable
                            onPress={() => mainClient.openFolder(d.savedPath)}
                            className="bg-zinc-200 dark:bg-zinc-800 px-3 py-1.5 rounded-lg active:bg-zinc-300 dark:active:bg-zinc-700"
                          >
                            <NouText className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                              {t('buttons.show')}
                            </NouText>
                          </Pressable>
                        )}
                        <Pressable
                          onPress={() => {
                            downloads$[dUrl].delete()
                          }}
                          className="bg-zinc-200 dark:bg-zinc-800 px-3 py-1.5 rounded-lg active:bg-zinc-300 dark:active:bg-zinc-700"
                        >
                          <NouText className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                            {t('buttons.clear')}
                          </NouText>
                        </Pressable>
                      </View>
                    </View>
                  )}
                  {d.phase === 'error' && (
                    <View className="gap-2">
                      <NouText className="text-sm text-red-700 dark:text-red-300 font-medium">
                        {d.errorMsg || t('modals.downloadFailed')}
                      </NouText>
                      <View className="flex-row justify-end mt-1">
                        <Pressable
                          onPress={() => {
                            downloads$[dUrl].delete()
                          }}
                          className="bg-zinc-200 dark:bg-zinc-800 px-3 py-1.5 rounded-lg active:bg-zinc-300 dark:active:bg-zinc-700"
                        >
                          <NouText className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                            {t('buttons.clear')}
                          </NouText>
                        </Pressable>
                      </View>
                    </View>
                  )}
                </View>
              )
            })}
          </View>
        )}
        {phase === 'loading' && <ActivityIndicator color={isDark ? 'white' : '#3f3f46'} />}

        {phase === 'choosing' && (
          <View className="gap-3">
            {!!parsedTitle && (
              <NouText className="text-sm font-medium text-zinc-600 dark:text-zinc-400 italic px-1">
                {parsedTitle}
              </NouText>
            )}
            {visibleFormats.map((opt) => {
              const isPinned = pinnedByFormatId.has(opt.formatId)
              return (
                <View
                  key={opt.formatId}
                  className={
                    isPinned
                      ? 'rounded-xl border border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-950/40 p-4 gap-3'
                      : 'rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 p-4 gap-3'
                  }
                >
                  <View className="flex-row items-center gap-3">
                    <View className="flex-1 gap-1">
                      <View className="flex-row items-center gap-2">
                        <NouText className="font-semibold">{opt.label}</NouText>
                        {nIf(
                          isPinned,
                          <NouText className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                            {t('modals.pinnedFormat')}
                          </NouText>,
                        )}
                      </View>
                      <NouText className="text-sm text-zinc-500 dark:text-zinc-400">{opt.description}</NouText>
                    </View>
                    <Pressable
                      onPress={() => togglePin(opt)}
                      accessibilityLabel={isPinned ? t('modals.unpinFormat') : t('modals.pinFormat')}
                      className="h-11 w-11 items-center justify-center rounded-full active:bg-zinc-200 dark:active:bg-zinc-800"
                    >
                      <MaterialIcons
                        name="push-pin"
                        size={20}
                        color={isPinned ? (isDark ? '#818cf8' : '#4f46e5') : isDark ? '#71717a' : '#a1a1aa'}
                      />
                    </Pressable>
                    <Pressable
                      disabled={isDownloadingCurrent}
                      onPress={() => handleDownload(opt.formatId)}
                      className={
                        isDownloadingCurrent
                          ? 'h-11 w-11 items-center justify-center rounded-full bg-zinc-300 dark:bg-zinc-700'
                          : 'h-11 w-11 items-center justify-center rounded-full bg-indigo-600 dark:bg-indigo-500 active:bg-indigo-700 dark:active:bg-indigo-400'
                      }
                    >
                      <MaterialIcons name="download" size={20} color="#fff" />
                    </Pressable>
                  </View>
                </View>
              )
            })}
            {nIf(
              hasAdvancedFormats,
              <Pressable
                onPress={() => setShowAllFormats(!showAllFormats)}
                className="flex-row items-center justify-center gap-1 rounded-lg py-2 active:bg-zinc-200 dark:active:bg-zinc-800"
              >
                <NouText className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">
                  {showAllFormats ? t('modals.showFewerFormats') : t('modals.showAllFormats')}
                </NouText>
                <MaterialIcons
                  name={showAllFormats ? 'expand-less' : 'expand-more'}
                  size={18}
                  color={isDark ? '#818cf8' : '#4f46e5'}
                />
              </Pressable>,
            )}
          </View>
        )}

        {phase === 'error' && (
          <View className="gap-3">
            <NouText className="text-sm text-red-500 dark:text-red-400">
              {errorMsg || t('modals.failedToLoadFormats')}
            </NouText>
          </View>
        )}

      </ScrollView>
    </BaseModal>
  )
}
