import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Animated,
  KeyboardAvoidingView,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native'
import { gray } from '@radix-ui/colors'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useValue } from '@legendapp/state/react'
import { sortBy } from 'es-toolkit'
import { t } from 'i18next'
import { bookmarks$, type Bookmark } from '@/states/bookmarks'
import { folders$, newFolder } from '@/states/folders'
import { ui$ } from '@/states/ui'
import { clsx, isWeb } from '@/lib/utils'
import { NouText } from '../NouText'
import { NouButton } from '../button/NouButton'

const UNGROUPED_ID = '__ungrouped__'
const NEW_FOLDER_ID = '__new__'

export const FeedEditorSheet: React.FC<{
  bookmark?: Bookmark
  onClose: () => void
  onRemove: (bookmark: Bookmark) => void
}> = ({ bookmark, onClose, onRemove }) => {
  const folders = useValue(folders$.folders)
  const { width } = useWindowDimensions()
  const isNarrowNative = !isWeb && width < 768
  const isDesktop = isWeb && width >= 768

  const [title, setTitle] = useState('')
  const [folderId, setFolderId] = useState<string | undefined>()
  const [folderPickerShown, setFolderPickerShown] = useState(false)
  const translateY = useRef(new Animated.Value(0)).current

  useEffect(() => {
    setTitle(bookmark?.title || '')
    setFolderId(bookmark?.json.folder)
    setFolderPickerShown(false)
    translateY.setValue(0)
  }, [bookmark, translateY])

  useEffect(() => {
    if (!bookmark || !isDesktop) {
      return
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keyup', handleKeyUp)
    return () => window.removeEventListener('keyup', handleKeyUp)
  }, [bookmark, isDesktop, onClose])

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) => Math.abs(gesture.dy) > 4 && gesture.dy > 0,
        onPanResponderMove: (_event, gesture) => {
          if (gesture.dy > 0) {
            translateY.setValue(gesture.dy)
          }
        },
        onPanResponderRelease: (_event, gesture) => {
          if (gesture.dy > 72 || gesture.vy > 0.9) {
            onClose()
            return
          }
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 0,
          }).start()
        },
        onPanResponderTerminate: () => {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 0,
          }).start()
        },
      }),
    [onClose, translateY],
  )

  const channelFolders = useMemo(
    () => sortBy(folders.filter((x) => !x.json.deleted && x.json.tab === 'channel'), ['name']),
    [folders],
  )
  const currentFolder = channelFolders.find((x) => x.id === folderId)

  if (!bookmark) {
    return null
  }

  const folderOptions = [
    { id: UNGROUPED_ID, name: t('modals.ungrouped') },
    ...channelFolders.map((folder) => ({ id: folder.id, name: folder.name })),
    { id: NEW_FOLDER_ID, name: t('feeds.newFolder') },
  ]

  const onSubmit = () => {
    const nextTitle = title.trim()
    if (!nextTitle) {
      return
    }
    bookmarks$.saveBookmark({
      ...bookmark,
      title: nextTitle,
      json: {
        ...bookmark.json,
        folder: folderId || undefined,
      },
    })
    onClose()
  }

  const onPickFolder = (nextFolderId: string) => {
    if (nextFolderId === NEW_FOLDER_ID) {
      ui$.folderModalFolder.set(newFolder('channel'))
      setFolderPickerShown(false)
      return
    }
    setFolderId(nextFolderId === UNGROUPED_ID ? undefined : nextFolderId)
    setFolderPickerShown(false)
  }

  const content = (
    <Animated.View
      className={clsx(
        'bg-zinc-100 dark:bg-zinc-950',
        isNarrowNative
          ? 'max-h-[92vh] rounded-t-[28px] px-5 pb-6 pt-4'
          : 'w-[32rem] max-w-[92vw] rounded-[28px] border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-900 px-6 pb-6 pt-6',
      )}
      style={
        isNarrowNative
          ? { transform: [{ translateY }] }
          : {
              shadowColor: '#000',
              shadowOpacity: 0.4,
              shadowRadius: 28,
              shadowOffset: { width: 0, height: 18 },
            }
      }
    >
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 8 }}>
        {isNarrowNative ? (
          <View className="mb-5 items-center py-2" {...panResponder.panHandlers}>
            <View className="h-1.5 w-14 rounded-full bg-zinc-300 dark:bg-zinc-700" />
          </View>
        ) : null}
        <NouText className="text-xl font-semibold">{t('feeds.editFeed')}</NouText>
        <NouText className={clsx('text-sm text-zinc-600 dark:text-zinc-400', isNarrowNative ? 'mt-1' : 'mt-2')}>
          {bookmark.url}
        </NouText>

        <View className="mt-6">
          <NouText className="mb-2 font-semibold text-zinc-700 dark:text-zinc-300">{t('modals.title')}</NouText>
          <TextInput
            className="rounded-2xl border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-900 px-4 py-3 text-zinc-900 dark:text-white"
            value={title}
            onChangeText={setTitle}
            placeholder={t('modals.title')}
            placeholderTextColor={gray.gray11}
          />
        </View>

        <View className="mt-5">
          <NouText className="mb-2 font-semibold text-zinc-700 dark:text-zinc-300">{t('modals.folder')}</NouText>
          <Pressable
            onPress={() => setFolderPickerShown((value) => !value)}
            className="rounded-2xl border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-900 px-4 py-3"
          >
            <NouText>{currentFolder?.name || t('modals.ungrouped')}</NouText>
          </Pressable>
          {folderPickerShown ? (
            <View className="mt-3 overflow-hidden rounded-2xl border border-zinc-300 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900">
              {folderOptions.map((item, index) => (
                <Pressable
                  key={item.id}
                  onPress={() => onPickFolder(item.id)}
                  className={clsx(
                    'px-4 py-3 active:bg-zinc-200 dark:active:bg-zinc-800',
                    index < folderOptions.length - 1 && 'border-b border-zinc-300 dark:border-zinc-800',
                  )}
                >
                  <NouText>{item.name}</NouText>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>

        <View className="mt-8 flex-row items-center justify-between gap-3">
          <NouButton variant="outline" size="1" onPress={() => onRemove(bookmark)}>
            {t('buttons.unsubscribe')}
          </NouButton>
          <NouButton onPress={onSubmit}>{t('buttons.save')}</NouButton>
        </View>
      </ScrollView>
    </Animated.View>
  )

  return (
    <View className="absolute inset-0 z-20" pointerEvents="box-none">
      <Pressable className={clsx('absolute inset-0', isDesktop ? 'bg-black/80' : 'bg-gray-600/70')} onPress={isDesktop ? undefined : onClose} />
      <KeyboardAvoidingView
        className={clsx('absolute inset-0', isNarrowNative ? 'justify-end' : 'items-center justify-center')}
        behavior={Platform.OS === 'ios' ? 'padding' : 'position'}
        keyboardVerticalOffset={isNarrowNative ? 24 : 0}
        pointerEvents="box-none"
      >
        {isNarrowNative ? (
          <SafeAreaView className="justify-end" edges={['bottom']} pointerEvents="box-none">
            {content}
          </SafeAreaView>
        ) : (
          <View className="px-6">{content}</View>
        )}
      </KeyboardAvoidingView>
    </View>
  )
}
