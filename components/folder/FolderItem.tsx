import { View, Text, Pressable, ScrollView } from 'react-native'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { observer, useValue, useObservable } from '@legendapp/state/react'
import { Folder, folders$, removeFolder } from '@/states/folders'
import { ui$, updateUrl } from '@/states/ui'
import { Button, ContextMenu } from '@expo/ui/jetpack-compose'
import { colors } from '@/lib/colors'
import { NouText } from '../NouText'
import { clsx, nIf, isWeb, isIos } from '@/lib/utils'
import { NouMenu } from '../menu/NouMenu'
import { MaterialButton } from '../button/IconButtons'
import { t } from 'i18next'

export const FolderItem: React.FC<{ folder: Folder; readOnly?: boolean; onPress: () => void }> = ({
  folder,
  readOnly,
  onPress,
}) => {
  return (
    <View className="flex-row overflow-hidden">
      <Pressable className="flex-1 flex-row items-center gap-2 ml-3 py-2" onPress={onPress}>
        <MaterialIcons name="folder-open" color={colors.icon} size={20} />
        <NouText className="leading-6" numberOfLines={4} ellipsizeMode="tail">
          {folder.name}
        </NouText>
      </Pressable>
      {nIf(
        !readOnly,
        <View>
          <NouMenu
            trigger={
              isWeb ? (
                <MaterialButton name="more-vert" size={20} />
              ) : isIos ? (
                'ellipsis'
              ) : (
                'filled.MoreVert'
              )
            }
            items={[
              { label: t('menus.edit'), handler: () => ui$.folderModalFolder.set(folder) },
              { label: t('menus.remove'), handler: () => removeFolder(folder) },
            ]}
          />
        </View>,
      )}
    </View>
  )
}
