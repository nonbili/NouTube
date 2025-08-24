import { View, Text, Pressable, ScrollView } from 'react-native'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { observer, use$, useObservable } from '@legendapp/state/react'
import { Folder, folders$, removeFolder } from '@/states/folders'
import { ui$, updateUrl } from '@/states/ui'
import { Button, ContextMenu } from '@expo/ui/jetpack-compose'
import { colors } from '@/lib/colors'
import { NouText } from '../NouText'
import { clsx } from '@/lib/utils'
import { NouMenu } from '../menu/NouMenu'
import { MaterialButton } from '../button/IconButtons'

export const FolderItem: React.FC<{ folder: Folder; onPress: () => void }> = ({ folder, onPress }) => {
  return (
    <View className="flex-row overflow-hidden">
      <Pressable className="flex-1 flex-row items-center gap-2 ml-3 py-2" onPress={onPress}>
        <MaterialIcons name="folder-open" color={colors.icon} size={20} />
        <NouText className="leading-6" numberOfLines={4} ellipsizeMode="tail">
          {folder.name}
        </NouText>
      </Pressable>
      <View>
        <NouMenu
          trigger={<MaterialButton name="more-vert" size={20} />}
          items={[
            { label: 'Edit', handler: () => ui$.folderModalFolder.set(folder) },
            { label: 'Remove', handler: () => removeFolder(folder) },
          ]}
        />
      </View>
    </View>
  )
}
