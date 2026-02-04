import { View, Text } from '@tarojs/components'
import { Button } from '@taroify/core'
import Taro from '@tarojs/taro'
import React, { useState } from 'react'
import { requestSubscribe } from '../../utils/subscribe'
import './index.scss'

interface InviteConfirmModalProps {
  visible: boolean
  inviteCode: string
  onClose: () => void
  onSuccess?: () => void
}

const InviteConfirmModal: React.FC<InviteConfirmModalProps> = React.memo(({
  visible,
  inviteCode,
  onClose,
  onSuccess
}) => {
  const [isBinding, setIsBinding] = useState(false)

  const handleConfirmBind = async () => {
    if (!inviteCode) return

    // 引导订阅
    await requestSubscribe(['BIND_SUCCESS'])

    setIsBinding(true)
    try {
      const res = await Taro.cloud.callFunction({
        name: 'syncBinding',
        data: { partnerCode: inviteCode }
      })
      const { success, message, alreadyBound } = res.result as any
      if (success) {
        Taro.showToast({ title: '绑定成功！', icon: 'success' })
        onClose()
        onSuccess?.()
      } else if (alreadyBound) {
        // 已经是伴侣，直接关闭并刷新
        Taro.showToast({ title: message, icon: 'success' })
        onClose()
        onSuccess?.()
      } else {
        Taro.showToast({ title: message || '绑定失败', icon: 'none' })
      }
    } catch (e) {
      Taro.showToast({ title: '网络异常', icon: 'none' })
    } finally {
      setIsBinding(false)
    }
  }

  if (!visible) return null

  return (
    <View className='invite-confirm-root' onClick={onClose}>
      <View className='confirm-card' onClick={e => e.stopPropagation()}>
        <View className='card-icon'>💕</View>
        <Text className='card-title'>收到绑定邀请</Text>
        <Text className='card-desc'>
          有人邀请你成为 TA 的另一半
        </Text>
        <Text className='card-code'>邀请码：{inviteCode}</Text>

        <View className='card-actions'>
          <Button
            className='cancel-btn'
            onClick={onClose}
            disabled={isBinding}
          >
            暂不绑定
          </Button>
          <Button
            className='confirm-btn'
            loading={isBinding}
            onClick={handleConfirmBind}
          >
            确认绑定
          </Button>
        </View>
      </View>
    </View>
  )
})

export default InviteConfirmModal
