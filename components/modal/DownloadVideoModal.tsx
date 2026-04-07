import { ActivityIndicator, View } from 'react-native'
import { useEffect, useState } from 'react'
import { useValue } from '@legendapp/state/react'
import { ui$ } from '@/states/ui'
import { BaseCenterModal } from './BaseCenterModal'
import { NouText } from '../NouText'
import { NouButton } from '../button/NouButton'
import { mainClient } from '@/desktop/src/renderer/ipc/main'
import { onDownloadProgress } from '@/desktop/src/renderer/lib/download-progress'
import { showToast } from '@/lib/toast'
import type { FormatOption } from '@/desktop/src/main/ipc/main'

type Phase = 'loading' | 'choosing' | 'downloading' | 'error'

export const DownloadVideoModal = () => {
  const url = useValue(ui$.downloadVideoModalUrl)
  const [phase, setPhase] = useState<Phase>('loading')
  const [formats, setFormats] = useState<FormatOption[]>([])
  const [progressLine, setProgressLine] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const onClose = () => ui$.downloadVideoModalUrl.set('')

  useEffect(() => {
    if (!url) {
      setPhase('loading')
      setFormats([])
      setProgressLine('')
      setErrorMsg('')
      onDownloadProgress(null)
      return
    }

    setPhase('loading')
    mainClient
      .listFormats(url)
      .then((result) => {
        setFormats(result)
        setPhase('choosing')
      })
      .catch((err: any) => {
        setErrorMsg(err?.message || 'Failed to load formats')
        setPhase('error')
      })
  }, [url])

  const handleDownload = async (formatId: string) => {
    setPhase('downloading')
    setProgressLine('')

    onDownloadProgress(({ line, done, error }) => {
      if (line) setProgressLine(line)
      if (done) {
        onDownloadProgress(null)
        if (error) {
          setPhase('error')
          setErrorMsg('Download failed')
        } else {
          showToast('Download complete')
          onClose()
        }
      }
    })

    mainClient.downloadVideo(url, formatId).catch(() => {
      // handled via downloadProgress done+error
    })
  }

  if (!url) return null

  const title =
    phase === 'loading'
      ? 'Loading...'
      : phase === 'choosing'
        ? 'Choose download quality'
        : phase === 'downloading'
          ? 'Downloading...'
          : 'Download failed'

  return (
    <BaseCenterModal onClose={onClose}>
      <View className="p-5 gap-4">
        <NouText className="text-lg font-semibold">{title}</NouText>

        {phase === 'loading' && <ActivityIndicator color="white" />}

        {phase === 'choosing' && (
          <View className="gap-3">
            {formats.map((opt) => (
              <View key={opt.formatId} className="rounded-xl border border-zinc-700 bg-zinc-900 p-4 gap-3">
                <View className="gap-1">
                  <NouText className="font-semibold">{opt.label}</NouText>
                  <NouText className="text-sm text-zinc-400">{opt.description}</NouText>
                </View>
                <NouButton onPress={() => void handleDownload(opt.formatId)}>Download</NouButton>
              </View>
            ))}
          </View>
        )}

        {phase === 'downloading' && (
          <NouText className="text-sm text-zinc-400 font-mono" numberOfLines={2}>
            {progressLine || ' '}
          </NouText>
        )}

        {phase === 'error' && (
          <View className="gap-4">
            <NouText className="text-sm text-red-400">{errorMsg}</NouText>
            <NouButton variant="outline" onPress={onClose}>
              Close
            </NouButton>
          </View>
        )}
      </View>
    </BaseCenterModal>
  )
}
