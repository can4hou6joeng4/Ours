import { View, Text, Image } from '@tarojs/components'
import { Button, Input } from '@taroify/core'
import Taro from '@tarojs/taro'
import React from 'react'
import { getIconifyUrl } from '../../utils/assets'
import './index.scss'

interface ProfileEditSheetProps {
  visible: boolean
  nickname: string
  avatar: string
  saving: boolean
  onClose: () => void
  onChangeNickname: (val: string) => void
  onChangeAvatar: (val: string) => void
  onSave: () => void
}

const ProfileEditSheet: React.FC<ProfileEditSheetProps> = ({
  visible,
  nickname,
  avatar,
  saving,
  onClose,
  onChangeNickname,
  onChangeAvatar,
  onSave
}) => {
  if (!visible) return null

  const onChooseAvatar = (e) => {
    const { avatarUrl } = e.detail
    if (avatarUrl) {
      onChangeAvatar(avatarUrl)
    }
  }

  return (
    <View className='edit-sheet-root' onClick={() => !saving && onClose()}>
      <View className='sheet-content' onClick={e => e.stopPropagation()}>
        <View className='sheet-header'>
          <Text className='title'>个人资料设置</Text>
          <View className='close' onClick={() => !saving && onClose()}>×</View>
        </View>

        <View className='sheet-body'>
          <View className='profile-edit-box'>
            <Button
              className='avatar-edit-btn'
              openType='chooseAvatar'
              onChooseAvatar={onChooseAvatar}
            >
              <View className='avatar-preview'>
                {avatar ? (
                  <Image src={avatar} className='img' mode='aspectFill' />
                ) : (
                  <Image src={getIconifyUrl('tabler:camera', '#D4B185')} className='icon' />
                )}
                <View className='upload-badge'>更换头像</View>
              </View>
            </Button>

            <View className='nickname-edit-area'>
              <Text className='label'>修改昵称</Text>
              <Input
                className='input'
                type='nickname'
                value={nickname}
                onChange={e => onChangeNickname(e.detail.value)}
                onBlur={e => onChangeNickname(e.detail.value)} // 兼容部分机型失去焦点时赋值
                placeholder='输入你的专属昵称'
              />
            </View>
          </View>
        </View>

        <View className='sheet-footer'>
          <Button
            className='save-btn'
            loading={saving}
            block
            onClick={onSave}
          >
            保存资料
          </Button>
        </View>
      </View>
    </View>
  )
}

export default ProfileEditSheet
