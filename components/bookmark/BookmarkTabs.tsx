import { Button } from '@expo/ui/jetpack-compose'
import { View, Text, ScrollView, Pressable } from 'react-native'
import { NouText } from '../NouText'
import { clsx } from '@/lib/utils'
import { useState } from 'react'
import { use$ } from '@legendapp/state/react'
import { settings$ } from '@/states/settings'
import { colors } from '@/lib/colors'
import { Picker } from '@expo/ui/jetpack-compose'

const tabsYT = ['Watchlist', 'Channels', 'Playlist']
const tabsYTMusic = ['Songs', 'Artists', 'Playlist']

export const BookmarkTabs: React.FC<{ tabIndex: number; onChange: (index: number) => void }> = ({
  tabIndex,
  onChange,
}) => {
  const isYTMusic = use$(settings$.isYTMusic)
  const tabs = isYTMusic ? tabsYTMusic : tabsYT

  return (
    <View className="flex items-center mb-4">
      <Picker
        elementColors={{
          activeContainerColor: '#4f4f4f',
          activeContentColor: colors.text,
          inactiveContainerColor: 'black',
          inactiveContentColor: colors.text,
        }}
        options={tabs}
        selectedIndex={tabIndex}
        onOptionSelected={({ nativeEvent: { index } }) => {
          onChange(index)
        }}
        variant="segmented"
      />
    </View>
  )

  return (
    <View className="w-full gap-x-3 gap-y-2 flex flex-row mb-4">
      {tabs.map((tab, index) => {
        const active = index == tabIndex
        return (
          <Pressable
            key={tab}
            onPress={() => onChange(index)}
            className={clsx('px-4 py-2 rounded-md', active ? 'bg-gray-100' : 'bg-[#2c2c2c]')}
          >
            <NouText className={clsx('font-medium', active && 'text-gray-900')}>{tab}</NouText>
          </Pressable>
        )
      })}
    </View>
  )
}
