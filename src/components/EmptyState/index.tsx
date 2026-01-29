import { View, Text, Button, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { getIconifyUrl } from '../../utils/assets'
import './index.scss'

interface EmptyStateProps {
  icon?: string
  title: string
  desc?: string
  btnText?: string
  onAction?: () => void
}

export default function EmptyState({ icon = 'tabler:ghost', title, desc, btnText, onAction }: EmptyStateProps) {
  return (
    <View className='empty-state-v2'>
      <View className='icon-box'>
        <Image src={getIconifyUrl(icon, '#D4B185')} className='icon' />
      </View>
      <Text className='title'>{title}</Text>
      {desc && <Text className='desc'>{desc}</Text>}
      {btnText && (
        <Button className='action-btn' onClick={onAction}>
          {btnText}
        </Button>
      )}
    </View>
  )
}
