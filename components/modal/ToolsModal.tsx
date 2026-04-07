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
import { t } from 'i18next'
import type { FormatOption } from '@/desktop/src/main/ipc/main'

type Phase = 'idle' | 'loading' | 'choosing' | 'downloading' | 'done' | 'error'

export const ToolsModal = () => {
  const toolsModalOpen = useValue(ui$.toolsModalOpen)
  const toolsModalUrl = useValue(ui$.toolsModalUrl)
  const isOpen = toolsModalOpen || !!toolsModalUrl
  const downloadPath = useValue(settings$.downloadPath)
  const [url, setUrl] = useState('')
  const [resolvedDownloadsPath, setResolvedDownloadsPath] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [formats, setFormats] = useState<FormatOption[]>([])
  const [progressLine, setProgressLine] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [savedPath, setSavedPath] = useState('')
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
      setProgressLine('')
      setErrorMsg('')
      setSavedPath('')
      onDownloadProgress(null)
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
    setErrorMsg('')
    mainClient
      .listFormats(targetUrl)
      .then((result) => {
        if (loadingUrlRef.current !== targetUrl) return
        setFormats(result)
        setPhase('choosing')
      })
      .catch((err: any) => {
        if (loadingUrlRef.current !== targetUrl) return
        setErrorMsg(err?.message || 'Failed to load formats')
        setPhase('error')
      })
  }

  const handleDownload = (formatId: string) => {
    setPhase('downloading')
    setProgressLine('')

    onDownloadProgress(({ line, done, error, filePath }) => {
      if (line) setProgressLine(line)
      if (done) {
        onDownloadProgress(null)
        if (error) {
          setPhase('error')
          setErrorMsg('Download failed')
        } else {
          setSavedPath(filePath || '')
          setPhase('done')
        }
      }
    })

    mainClient.downloadVideo(toolsModalUrl || url, formatId, effectiveDownloadPath).catch(() => {
      // handled via downloadProgress done+error
    })
  }

  if (!isOpen) return null

  return (
    <BaseModal onClose={onClose}>
      <View className="p-5 gap-4">
        <NouText className="text-lg font-semibold">
          {phase === 'done'
            ? 'Download complete'
            : phase === 'downloading'
              ? 'Downloading...'
              : t('modals.downloadVideo', 'Download video')}
        </NouText>

        {(phase === 'done' || phase === 'downloading') ? null : <View className="gap-1">
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
        </View>}

        {(phase === 'idle' || phase === 'choosing') && (
          <View className="gap-1">
            <NouText className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">Save to</NouText>
            <Pressable
              className="flex-row items-center gap-2 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-2 active:bg-zinc-100 dark:active:bg-zinc-800"
              onPress={async () => {
                const picked = await mainClient.selectFolder()
                if (picked) settings$.downloadPath.set(picked)
              }}
            >
              <NouText className="flex-1 text-sm text-zinc-700 dark:text-zinc-300" numberOfLines={1}>
                {effectiveDownloadPath || '…'}
              </NouText>
              <NouText className="text-xs text-zinc-400 dark:text-zinc-500">Browse</NouText>
            </Pressable>
          </View>
        )}

        {phase === 'idle' && (
          <View className="flex-row justify-end">
            <NouButton disabled={!url.trim()} onPress={() => loadFormats(url.trim())}>
              Next
            </NouButton>
          </View>
        )}

        {phase === 'loading' && <ActivityIndicator color={isDark ? 'white' : '#3f3f46'} />}

        {phase === 'choosing' && (
          <View className="gap-3">
            {formats.map((opt) => (
              <View key={opt.formatId} className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 p-4 gap-3">
                <View className="gap-1">
                  <NouText className="font-semibold">{opt.label}</NouText>
                  <NouText className="text-sm text-zinc-500 dark:text-zinc-400">{opt.description}</NouText>
                </View>
                <NouButton onPress={() => handleDownload(opt.formatId)}>Download</NouButton>
              </View>
            ))}
          </View>
        )}

        {phase === 'downloading' && (
          <NouText className="text-sm text-zinc-500 dark:text-zinc-400 font-mono" numberOfLines={2}>
            {progressLine || ' '}
          </NouText>
        )}

        {phase === 'done' && (
          <View className="gap-4">
            <NouText className="text-sm text-zinc-500 dark:text-zinc-400 font-mono" numberOfLines={3}>
              {savedPath || 'Saved to Downloads folder'}
            </NouText>
            <View className="flex-row justify-end gap-3">
              {!!savedPath && (
                <NouButton variant="soft" onPress={() => mainClient.openFolder(savedPath)}>
                  Show in folder
                </NouButton>
              )}
              <NouButton onPress={onClose}>Done</NouButton>
            </View>
          </View>
        )}

        {phase === 'error' && (
          <View className="gap-3">
            <NouText className="text-sm text-red-500 dark:text-red-400">{errorMsg}</NouText>
            <View className="flex-row justify-end">
              <NouButton variant="outline" onPress={onClose}>
                Close
              </NouButton>
            </View>
          </View>
        )}
      </View>
    </BaseModal>
  )
}
