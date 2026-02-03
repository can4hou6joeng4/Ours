import { View, Text, Image } from '@tarojs/components'
import React from 'react'
import { getIconifyUrl } from '../../utils/assets'
import './index.scss'

interface UserHeaderCardProps {
  userInfo: any
  onEdit: () => void
}

const UserHeaderCard: React.FC<UserHeaderCardProps> = ({ userInfo, onEdit }) => {
  return (
    <View className='user-card' onClick={onEdit}>
      <View className='avatar-placeholder'>
        {userInfo?.avatarUrl ? (
          <Image src={userInfo.avatarUrl} className='avatar-image' mode='aspectFill' />
        ) : (
          <Image src={getIconifyUrl('tabler:user-circle', '#D4B185')} className='avatar-icon' />
        )}
      </View>
      <View className='info'>
        <Text className='nickname-display'>
          {userInfo?.nickName || (userInfo?.partnerId ? 'PREMIUM USER' : 'GUEST')}
        </Text>
        <Text className={`points ${(userInfo?.totalPoints || 0) < 0 ? 'negative' : ''}`}>
          积分资产：{userInfo?.totalPoints || 0}
        </Text>
      </View>
    </View>
  )
}

export default UserHeaderCard
