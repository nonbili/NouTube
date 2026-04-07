import { ActivityIndicator, Pressable, TextInput, View, useColorScheme } from 'react-native'
import { useEffect, useRef, useState } from 'react'
import { useValue } from '@legendapp/state/react'
import { ui$ } from '@/states/ui'
import { settings$ } from '@/states/settings'
import { BaseModal } from './BaseModal'
import { NouText } from '../NouText'
import { NouButton } from '../button/NouButton'
import { mainClient } from '@/desktop/src/renderer/ipc/main'
import { onDownloadProgress } from '@/desktop/src/renderer/lib/download-progress'
import { downloads$ } from '@/states/downloads'
import { t } from 'i18next'
import type { FormatOption } from '@/desktop/src/main/ipc/main'
import { showToast } from '@/lib/toast'

type Phase = 'idle' | 'loading' | 'choosing' | 'error'

export const ToolsModal = () => {
  const toolsModalOpen = useValue(ui$.toolsModalOpen)
  const toolsModalUrl = useValue(ui$.toolsModalUrl)
  const isOpen = toolsModalOpen || !!toolsModalUrl
  const downloadPath = useValue(settings$.downloadPath)
  const [url, setUrl] = useState('')
  const [resolvedDownloadsPath, setResolvedDownloadsPath] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [formats, setFormats] = useState<FormatOption[]>([])
  const [parsedTitle, setParsedTitle] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const activeDownloads = useValue(downloads$)
  const loadingUrlRef = useRef('')
  const isDark = useColorScheme() !== 'light'
  const effectiveDownloadPath = downloadPath || resolvedDownloadsPath

  const onClose = () => {
    ui$.toolsModalOpen.set(false)
    ui$.toolsModalUrl.set('')
  }

  useEffect(() => {
    mainClient.getDownloadsPath().then(setResolvedDownloadsPath)
  }, [])

  useEffect(() => {
    if (!isOpen) {
      setUrl('')
      setPhase('idle')
      setFormats([])
      setParsedTitle('')
      setErrorMsg('')
      return
    }
    if (toolsModalUrl) {
      setUrl(toolsModalUrl)
      loadFormats(toolsModalUrl)
    }
  }, [isOpen, toolsModalUrl])

  const loadFormats = (targetUrl: string) => {
    loadingUrlRef.current = targetUrl
    setPhase('loading')
    setFormats([])
    setParsedTitle('')
    setErrorMsg('')
    mainClient
      .listFormats(targetUrl)
      .then((result) => {
        if (loadingUrlRef.current !== targetUrl) return
        setFormats(result.formats)
        setParsedTitle(result.title)
        setPhase('choosing')
      })
      .catch((err: any) => {
        if (loadingUrlRef.current !== targetUrl) return
        setErrorMsg(err?.message || t('modals.failedToLoadFormats'))
        setPhase('error')
      })
  }

  const handleDownload = (formatId: string) => {
    const targetUrl = toolsModalUrl || url
    downloads$[targetUrl].set({
      url: targetUrl,
      phase: 'downloading',
      progressLine: '',
      errorMsg: '',
      savedPath: '',
    })
    setPhase('idle')
    setUrl('')
    ui$.toolsModalUrl.set('')

    mainClient.downloadVideo(targetUrl, formatId, effectiveDownloadPath).catch(() => {
      // handled via downloadProgress done+error
    })
  }

  if (!isOpen) return null

  const activeDownloadUrls = Object.keys(activeDownloads)

  return (
    <BaseModal onClose={onClose}>
      <View className="p-5 gap-4">
        <View className="flex-row items-center justify-between">
          <NouText className="text-lg font-semibold">{t('modals.downloadVideo', 'Download video')}</NouText>
          {activeDownloadUrls.length > 0 && (
            <Pressable
              onPress={() => {
                downloads$.set({})
              }}
              className="px-2 py-1 rounded-md active:bg-zinc-200 dark:active:bg-zinc-800"
            >
              <NouText className="text-xs text-zinc-500 font-medium">{t('buttons.clearAll')}</NouText>
            </Pressable>
          )}
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
            placeholder="https://www.youtube.com/watch?v=..."
            placeholderTextColor={isDark ? '#71717a' : '#a1a1aa'}
          />
        </View>

        {(phase === 'idle' || phase === 'choosing') && (
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
          </View>
        )}

        {phase === 'idle' && (
          <View className="flex-row justify-end">
            <NouButton disabled={!url.trim()} onPress={() => loadFormats(url.trim())}>
              {t('buttons.next')}
            </NouButton>
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
            {formats.map((opt) => (
              <View
                key={opt.formatId}
                className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 p-4 gap-3"
              >
                <View className="gap-1">
                  <NouText className="font-semibold">{opt.label}</NouText>
                  <NouText className="text-sm text-zinc-500 dark:text-zinc-400">{opt.description}</NouText>
                </View>
                <NouButton onPress={() => handleDownload(opt.formatId)}>{t('buttons.download')}</NouButton>
              </View>
            ))}
          </View>
        )}

        {phase === 'error' && (
          <View className="gap-3">
            <NouText className="text-sm text-red-500 dark:text-red-400">{errorMsg || t('modals.failedToLoadFormats')}</NouText>
          </View>
        )}

        {activeDownloadUrls.length > 0 && (
          <View className="mt-4 gap-4">
            <NouText className="text-sm font-bold uppercase tracking-widest text-zinc-500">{t('modals.activeDownloads')}</NouText>
            {activeDownloadUrls.map((dUrl) => {
              const d = activeDownloads[dUrl]
              return (
                <View
                  key={dUrl}
                  className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 p-4 gap-2"
                >
                  <NouText className="text-xs text-zinc-500" numberOfLines={1}>
                    {dUrl}
                  </NouText>
                  {d.phase === 'downloading' && (
                    <NouText className="text-sm text-zinc-500 dark:text-zinc-400 font-mono" numberOfLines={2}>
                      {d.progressLine || t('modals.starting')}
                    </NouText>
                  )}
                  {d.phase === 'done' && (
                    <View className="gap-2">
                      <NouText className="text-sm text-green-600 dark:text-green-400 font-medium">
                        {t('modals.downloadComplete')}
                      </NouText>
                      <NouText className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono" numberOfLines={2}>
                        {d.savedPath}
                      </NouText>
                      <View className="flex-row justify-end gap-3 mt-1">
                        {!!d.savedPath && (
                          <Pressable
                            onPress={() => mainClient.openFolder(d.savedPath)}
                            className="bg-zinc-200 dark:bg-zinc-800 px-3 py-1.5 rounded-lg active:bg-zinc-300 dark:active:bg-zinc-700"
                          >
                            <NouText className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">{t('buttons.show')}</NouText>
                          </Pressable>
                        )}
                        <Pressable
                          onPress={() => {
                            downloads$[dUrl].delete()
                          }}
                          className="bg-zinc-200 dark:bg-zinc-800 px-3 py-1.5 rounded-lg active:bg-zinc-300 dark:active:bg-zinc-700"
                        >
                          <NouText className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">{t('buttons.clear')}</NouText>
                        </Pressable>
                      </View>
                    </View>
                  )}
                  {d.phase === 'error' && (
                    <View className="gap-2">
                      <NouText className="text-sm text-red-500 dark:text-red-400">{d.errorMsg || t('modals.downloadFailed')}</NouText>
                      <View className="flex-row justify-end mt-1">
                        <Pressable
                          onPress={() => {
                            downloads$[dUrl].delete()
                          }}
                          className="bg-zinc-200 dark:bg-zinc-800 px-3 py-1.5 rounded-lg active:bg-zinc-300 dark:active:bg-zinc-700"
                        >
                          <NouText className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">{t('buttons.clear')}</NouText>
                        </Pressable>
                      </View>
                    </View>
                  )}
                </View>
              )
            })}
          </View>
        )}
      </View>
    </BaseModal>
  )
}
