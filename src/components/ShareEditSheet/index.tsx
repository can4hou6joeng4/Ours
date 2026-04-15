import { View, Text, Button as TaroButton } from '@tarojs/components'
import { Textarea } from '@taroify/core'
import Taro from '@tarojs/taro'
import React, { useState } from 'react'
import './index.scss'

interface ShareEditSheetProps {
  visible: boolean
  inviteCode: string
  onClose: () => void
}

// 预设的分享标题模板
const TITLE_TEMPLATES = [
  '邀请你成为我的另一半 💕',
  '和我一起开启甜蜜任务吧~',
  '快来和我组队！一起变得更好',
  '我在等你，一起记录我们的点滴'
]

const ShareEditSheet: React.FC<ShareEditSheetProps> = React.memo(({
  visible,
  inviteCode,
  onClose
}) => {
  const [title, setTitle] = useState(TITLE_TEMPLATES[0])
  const [selectedIndex, setSelectedIndex] = useState(0)

  const handleSelectTemplate = (index: number) => {
    setSelectedIndex(index)
    setTitle(TITLE_TEMPLATES[index])
  }

  const handleShare = () => {
    // 保存自定义分享内容到 Storage，供 onShareAppMessage 读取
    Taro.setStorageSync('customShareTitle', title)
    Taro.setStorageSync('customShareCode', inviteCode)
  }

  if (!visible) return null

  return (
    <View className='share-edit-root' onClick={onClose}>
      <View className='sheet-content' onClick={e => e.stopPropagation()}>
        <View className='sheet-header'>
          <Text className='title'>编辑邀请内容</Text>
          <View className='close' onClick={onClose}>×</View>
        </View>

        <View className='sheet-body'>
          {/* 标题模板选择 */}
          <View className='section'>
            <Text className='label'>选择邀请语</Text>
            <View className='template-list'>
              {TITLE_TEMPLATES.map((tpl, index) => (
                <View
                  key={index}
                  className={`template-item ${selectedIndex === index ? 'active' : ''}`}
                  onClick={() => handleSelectTemplate(index)}
                >
                  <Text className='template-text'>{tpl}</Text>
                  {selectedIndex === index && <Text className='check-icon'>✓</Text>}
                </View>
              ))}
            </View>
          </View>

          {/* 自定义输入 */}
          <View className='section'>
            <Text className='label'>或自定义内容</Text>
            <Textarea
              className='custom-textarea'
              placeholder='输入你想说的话...'
              value={title}
              maxlength={30}
              onChange={(e) => {
                setTitle(e.detail.value)
                setSelectedIndex(-1)
              }}
            />
            <Text className='char-count'>{title.length}/30</Text>
          </View>

          {/* 预览 */}
          <View className='section preview-section'>
            <Text className='label'>分享预览</Text>
            <View className='preview-card'>
              <View className='preview-title'>{title || '邀请你成为我的另一半'}</View>
              <View className='preview-desc'>点击加入，开启我们的专属空间</View>
            </View>
          </View>
        </View>

        <View className='sheet-footer'>
          <TaroButton
            className='share-confirm-btn'
            openType='share'
            onClick={handleShare}
          >
            发送给好友
          </TaroButton>
        </View>
      </View>
    </View>
  )
})

export default ShareEditSheet
