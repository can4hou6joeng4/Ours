import { View, Text, Button } from '@tarojs/components'
import React from 'react'
import './index.scss'

interface NoticeModalProps {
  visible: boolean
  notice: any
  closing: boolean
  onClose: () => void
}

const NoticeModal: React.FC<NoticeModalProps> = ({ visible, notice, closing, onClose }) => {
  if (!visible || !notice) return null

  return (
    <View className='notice-modal-root' onClick={onClose}>
      <View className={`notice-card ${closing ? 'closing' : ''}`} onClick={e => e.stopPropagation()}>
        <View className='card-header'>
          <View className='notice-tag'>{notice.type}</View>
          <View className='close-btn' onClick={onClose}>×</View>
        </View>

        <View className='card-body'>
          <View className='notice-icon-box'>
            {notice.type === 'NEW_TASK' && <Text className='emoji'>✨</Text>}
            {notice.type === 'TASK_CONFIRM' && <Text className='emoji'>👀</Text>}
            {notice.type === 'TASK_DONE' && <Text className='emoji'>🎉</Text>}
            {notice.type === 'NEW_GIFT' && <Text className='emoji'>🎁</Text>}
            {notice.type === 'GIFT_USED' && <Text className='emoji'>💝</Text>}
          </View>

          <Text className='notice-title'>{notice.title}</Text>
          <View className='notice-message-box'>
            <Text className='notice-message'>{notice.message}</Text>
          </View>

          {notice.points !== 0 && (
            <View className='notice-points'>
              <Text className='label'>积分变动</Text>
              <Text className={`value ${notice.points > 0 ? 'plus' : 'minus'}`}>
                {notice.points > 0 ? '+' : ''}{notice.points}
              </Text>
            </View>
          )}
        </View>

        <View className='card-footer'>
          <Button className='btn-confirm' onClick={onClose}>
            我已收到 ⟩
          </Button>
        </View>
      </View>
    </View>
  )
}

export default NoticeModal
