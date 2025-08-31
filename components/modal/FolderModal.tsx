import { use$ } from '@legendapp/state/react'
import { ui$ } from '@/states/ui'
import { BaseCenterModal } from './BaseCenterModal'
import { NouText } from '../NouText'
import { TextInput, TouchableOpacity, View } from 'react-native'
import { useEffect, useState } from 'react'
import { gray } from '@radix-ui/colors'
import { folders$, newFolder } from '@/states/folders'

export const FolderModal = () => {
  const folder = use$(ui$.folderModalFolder)
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
        <NouText className="mb-1">Name</NouText>
        <TextInput
          className="border border-gray-600 rounded mb-4 text-white p-2"
          value={name}
          onChangeText={setName}
          placeholder="Later"
          placeholderTextColor={gray.gray11}
          autoFocus
        />
        <View className="flex-row justify-end mt-4">
          <TouchableOpacity onPress={onSubmit}>
            <NouText className="py-2 px-6 text-center bg-indigo-600 rounded-full">Save</NouText>
          </TouchableOpacity>
        </View>
      </View>
    </BaseCenterModal>
  )
}
