import { View, Pressable, useColorScheme } from 'react-native'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { Folder, removeFolder } from '@/states/folders'
import { ui$ } from '@/states/ui'
import { colors } from '@/lib/colors'
import { NouText } from '../NouText'
import { nIf, isWeb, isIos } from '@/lib/utils'
import { NouMenu } from '../menu/NouMenu'
import { MaterialButton } from '../button/IconButtons'
import { t } from 'i18next'

export const FolderItem: React.FC<{ folder: Folder; readOnly?: boolean; onPress: () => void }> = ({
  folder,
  readOnly,
  onPress,
}) => {
  const colorScheme = useColorScheme()
  const isDark = colorScheme !== 'light'

  return (
    <View className="flex-row overflow-hidden">
      <Pressable className="flex-1 flex-row items-center gap-2 ml-3 py-2" onPress={onPress}>
        <MaterialIcons name="folder-open" color={isDark ? colors.icon : colors.iconLight} size={20} />
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
              {
                label: t('menus.edit'),
                icon: <MaterialIcons name="edit" size={18} color={isDark ? '#d4d4d8' : '#475569'} />,
                systemImage: 'pencil',
                handler: () => ui$.folderModalFolder.set(folder),
              },
              {
                label: t('menus.remove'),
                icon: <MaterialIcons name="delete-outline" size={18} color={isDark ? '#d4d4d8' : '#475569'} />,
                systemImage: 'trash',
                handler: () => removeFolder(folder),
              },
            ]}
          />
        </View>,
      )}
    </View>
  )
}
