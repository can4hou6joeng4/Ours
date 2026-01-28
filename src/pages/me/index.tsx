import { useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { View, Text, Button } from '@tarojs/components'
import './index.scss'

export default function Me() {
  const [userInfo, setUserInfo] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useDidShow(() => {
    fetchUserInfo()
  })

  const fetchUserInfo = async () => {
    setLoading(true)
    try {
      const res = await Taro.cloud.callFunction({ name: 'initUser' })
      const data = res.result as any
      if (data.success) {
        setUserInfo(data.user)
      }
    } catch (e) {
      console.error('获取用户信息失败', e)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <View className='container'><Text>加载中...</Text></View>

  return (
    <View className='container'>
      {/* 个人资料卡片 */}
      <View className='user-card'>
        <View className='avatar-placeholder'>👤</View>
        <View className='info'>
          <Text className='nickname'>{userInfo?.partnerId ? '已绑定关系' : '尚未绑定关系'}</Text>
          <Text className={`points ${(userInfo?.totalPoints || 0) < 0 ? 'negative' : ''}`}>
            当前积分：{userInfo?.totalPoints || 0}
          </Text>
        </View>
      </View>

      {/* 功能菜单区 */}
      <View className='menu-list'>
        <View className='menu-item' onClick={() => Taro.navigateTo({ url: '/pages/inventory/index' })}>
          <View className='menu-left'>
            <Text className='menu-icon'>📦</Text>
            <Text className='menu-label'>我的背包</Text>
          </View>
          <Text className='menu-arrow'>⟩</Text>
        </View>
      </View>

      {/* 另一半/绑定状态区 */}
      <View className='binding-section'>
        <Text className='section-label'>我的另一半</Text>
        <View className='binding-card'>
          {!userInfo?.partnerId ? (
            <View className='binding-guide'>
              <Text className='guide-text'>绑定另一半，开启双人互动空间</Text>
              <Button className='action-btn' onClick={() => Taro.navigateTo({ url: '/pages/binding/index' })}>
                去绑定
              </Button>
            </View>
          ) : (
            <View className='partner-info-box'>
              <View className='partner-status'>
                已关联：{userInfo.partnerId.slice(-6)}
              </View>
              <Button className='unbind-btn'>解除绑定 (暂未开放)</Button>
            </View>
          )}
        </View>
      </View>
    </View>
  )
}
