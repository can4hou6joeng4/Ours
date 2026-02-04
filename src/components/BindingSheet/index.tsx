import { View, Text } from '@tarojs/components'
import { Button, Input } from '@taroify/core'
import Taro from '@tarojs/taro'
import React, { useState, useEffect } from 'react'
import { requestSubscribe } from '../../utils/subscribe'
import ShareEditSheet from '../ShareEditSheet'
import './index.scss'

interface BindingSheetProps {
  visible: boolean
  onClose: () => void
  onSuccess?: () => void
}

const BindingSheet: React.FC<BindingSheetProps> = React.memo(({
  visible,
  onClose,
  onSuccess
}) => {
  const [myCode, setMyCode] = useState('')
  const [inputCode, setInputCode] = useState('')
  const [isBinding, setIsBinding] = useState(false)
  const [showShareEdit, setShowShareEdit] = useState(false)

  useEffect(() => {
    if (visible && !myCode) {
      // 获取当前用户的邀请码
      Taro.cloud.callFunction({
        name: 'getUserInfo'
      }).then(res => {
        const { openid } = res.result as any
        setMyCode(openid.slice(-6).toUpperCase())
      })
    }
  }, [visible, myCode])

  const handleCopyCode = () => {
    Taro.setClipboardData({
      data: myCode,
      success: () => {
        Taro.showToast({ title: '已复制', icon: 'success' })
      }
    })
  }

  const handleBind = async () => {
    if (!inputCode || inputCode.length < 6) {
      Taro.showToast({ title: '请输入完整邀请码', icon: 'none' })
      return
    }

    // 引导订阅
    await requestSubscribe(['BIND_SUCCESS'])

    setIsBinding(true)
    try {
      const res = await Taro.cloud.callFunction({
        name: 'syncBinding',
        data: { partnerCode: inputCode }
      })
      const { success, message } = res.result as any
      if (success) {
        Taro.showToast({ title: '绑定成功！', icon: 'success' })
        setInputCode('')
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
    <View className='binding-sheet-root' onClick={onClose}>
      <View className='sheet-content' onClick={e => e.stopPropagation()}>
        <View className='sheet-header'>
          <View className='header-info'>
            <Text className='title'>建立连接</Text>
            <Text className='subtitle'>ESTABLISH CONNECTION</Text>
          </View>
          <View className='close' onClick={onClose}>×</View>
        </View>

        <View className='sheet-body'>
          {/* 我的邀请码 */}
          <View className='section'>
            <Text className='label'>我的邀请码</Text>
            <View className='code-box'>
              <Text className='code'>{myCode || '------'}</Text>
              <View className='code-actions'>
                <View className='copy-btn' onClick={handleCopyCode}>复制</View>
                <View
                  className='share-btn'
                  onClick={() => setShowShareEdit(true)}
                >
                  邀请
                </View>
              </View>
            </View>
          </View>

          <View className='divider'>
            <Text className='divider-text'>或输入对方邀请码</Text>
          </View>

          {/* 输入对方邀请码 */}
          <View className='section'>
            <Text className='label'>对方邀请码</Text>
            <Input
              className='custom-input'
              placeholder='输入 6 位邀请码'
              value={inputCode}
              maxlength={6}
              onChange={(e) => setInputCode(e.detail.value.toUpperCase())}
            />
          </View>
        </View>

        <View className='sheet-footer'>
          <Button
            className='bind-btn'
            loading={isBinding}
            disabled={!inputCode || inputCode.length < 6}
            block
            onClick={handleBind}
          >
            立即绑定
          </Button>
        </View>
      </View>

      {/* 分享内容编辑弹窗 */}
      <ShareEditSheet
        visible={showShareEdit}
        inviteCode={myCode}
        onClose={() => setShowShareEdit(false)}
      />
    </View>
  )
})

export default BindingSheet
