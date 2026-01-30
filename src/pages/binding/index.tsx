import { useState, useEffect } from 'react'
import Taro from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
import { Button, Input } from '@taroify/core'
import './index.scss'

export default function Binding() {
  const [myCode, setMyCode] = useState('')
  const [inputCode, setInputCode] = useState('')
  const [isBinding, setIsBinding] = useState(false)

  useEffect(() => {
    // 获取当前用户的邀请码（简单起见，取 OpenID 后 6 位或随机数）
    Taro.cloud.callFunction({
      name: 'getUserInfo'
    }).then(res => {
      const { openid } = res.result as any
      setMyCode(openid.slice(-6).toUpperCase())
    })
  }, [])

  const handleBind = async () => {
    if (!inputCode) return
    setIsBinding(true)
    try {
      const res = await Taro.cloud.callFunction({
        name: 'syncBinding',
        data: { partnerCode: inputCode }
      })
      const { success, message } = res.result as any
      if (success) {
        Taro.showToast({ title: '绑定成功！', icon: 'success' })
        setTimeout(() => Taro.reLaunch({ url: '/pages/index/index' }), 1500)
      } else {
        Taro.showToast({ title: message || '绑定失败', icon: 'none' })
      }
    } catch (e) {
      Taro.showToast({ title: '网络异常', icon: 'none' })
    } finally {
      setIsBinding(false)
    }
  }

  return (
    <View className='container'>
      <View className='card'>
        <Text className='title'>建立 1对1 绑定</Text>
        <Text className='subtitle'>ESTABLISH CONNECTION / 开启专属空间</Text>

        <View className='section'>
          <Text className='label'>我的邀请码</Text>
          <View className='code-box'>
            <Text className='code'>{myCode}</Text>
            <Button className='copy-btn' onClick={() => Taro.setClipboardData({ data: myCode })}>复制</Button>
          </View>
        </View>

        <View className='divider'>或</View>

        <View className='section'>
          <Text className='label'>输入对方邀请码</Text>
          <Input
            className='custom-input'
            placeholder='输入 6 位邀请码'
            value={inputCode}
            onChange={(e) => setInputCode(e.detail.value)}
          />
        </View>

        <Button
          className='bind-btn'
          loading={isBinding}
          block
          onClick={handleBind}
        >
          立即绑定
        </Button>
      </View>
    </View>
  )
}
