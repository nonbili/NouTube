import { useValue } from '@legendapp/state/react'
import { ui$ } from '@/states/ui'
import { BaseCenterModal } from './BaseCenterModal'
import { NouText } from '../NouText'
import { TextInput, View } from 'react-native'
import { useEffect, useState } from 'react'
import { gray } from '@radix-ui/colors'
import { folders$ } from '@/states/folders'
import { NouButton } from '../button/NouButton'

export const FolderModal = () => {
  const folder = useValue(ui$.folderModalFolder)
  const onClose = () => ui$.folderModalFolder.set(undefined)
  const [name, setName] = useState('')

  useEffect(() => {
    setName(folder?.name || '')
  }, [folder])

  if (!folder) {
    return null
  }

  const onSubmit = () => {
    if (!name) {
      return
    }
    folder.name = name
    folders$.saveFolder(folder)
    onClose()
  }

  return (
    <BaseCenterModal onClose={onClose}>
      <View className="p-5">
        <NouText className="text-lg font-semibold mb-4">{folder.name ? 'Edit folder' : 'New folder'}</NouText>
        <NouText className="mb-1 font-semibold text-zinc-700 dark:text-zinc-300">Name</NouText>
        <TextInput
          className="border border-zinc-300 dark:border-gray-600 bg-white dark:bg-zinc-900 rounded mb-4 text-zinc-900 dark:text-white p-2"
          value={name}
          onChangeText={setName}
          placeholder="Later"
          placeholderTextColor={gray.gray11}
          autoFocus
        />
        <View className="flex-row justify-end mt-4">
          <NouButton onPress={onSubmit}>Save</NouButton>
        </View>
      </View>
    </BaseCenterModal>
  )
}
