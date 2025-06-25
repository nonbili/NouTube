import { Modal, Text, Pressable, View } from 'react-native'
import { NouText } from '../NouText'
import { NouLink } from '../NouLink'
import { version } from '../../package.json'

const repo = 'https://github.com/nonbili/noutube'

export const AboutModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  return (
    <Modal animationType="slide" transparent={true} visible={true} onRequestClose={onClose}>
      <View className="flex-1 mt-16 bg-gray-900/50">
        <View className="bg-[#222] py-6 px-8">
          <View className="items-center mb-8">
            <NouText className="text-lg font-medium">NouTube</NouText>
            <NouText>v{version}</NouText>
          </View>
          <View className="">
            <NouText className="font-medium">Source code</NouText>
            <NouLink className="text-blue-300" href={repo}>
              {repo}
            </NouLink>
          </View>
          <View className="items-center mt-12">
            <Pressable onPress={onClose}>
              <NouText className="py-2 px-6 text-center bg-gray-700 rounded-full">Close</NouText>
            </Pressable>
          </View>
        </View>
        <Pressable className="flex-1" onPress={onClose} />
      </View>
    </Modal>
  )
}
