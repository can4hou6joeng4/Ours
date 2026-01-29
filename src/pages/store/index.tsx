import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import { Grid, Card, Button, Box, Space } from 'dux-ui'
import './index.scss'

const PRODUCTS = [
  { id: 1, name: '电影日', points: 500, desc: '一起看一场想看的电影', icon: '🎬', type: 'movie' },
  { id: 2, name: '家务抵用券', points: 300, desc: '对方帮你分担一次家务', icon: '🧹', type: 'chore' },
  { id: 3, name: '整蛊盲盒', points: 200, desc: '随机触发一个有趣的整蛊', icon: '🎁', type: 'box' },
  { id: 4, name: '奶茶自由', points: 150, desc: '获得一杯心仪的奶茶', icon: '🧋', type: 'tea' },
  { id: 5, name: '免死金牌', points: 1000, desc: '犯错时可抵消一次惩罚', icon: '🏅', type: 'medal' }
]

export default function Store() {
  const [totalPoints, setTotalPoints] = useState(0)

  useDidShow(() => {
    fetchUserInfo()
  })

  const fetchUserInfo = async () => {
    try {
      const { result }: any = await Taro.cloud.callFunction({ name: 'initUser' })
      if (result.success) {
        setTotalPoints(result.user.totalPoints)
      }
    } catch (e) {
      console.error('获取用户信息失败', e)
    }
  }

  const handleBuy = async (item) => {
    // TODO: 请用户在此处完善具体的积分余额校验逻辑
    if (totalPoints < item.points) {
      Taro.showToast({ title: '积分不足', icon: 'error' })
      return
    }

    const confirm = await Taro.showModal({
      title: '确认兑换',
      content: `确定要花费 ${item.points} 积分兑换“${item.name}”吗？`
    })

    if (!confirm.confirm) return

    Taro.showLoading({ title: '处理中...' })
    try {
      const { result }: any = await Taro.cloud.callFunction({
        name: 'buyItem',
        data: { item: { name: item.name, points: item.points } }
      })

      if (result.success) {
        Taro.showToast({ title: '兑换成功', icon: 'success' })
        fetchUserInfo()
      } else {
        Taro.showToast({ title: result.error || '兑换失败', icon: 'none' })
      }
    } catch (e) {
      Taro.showToast({ title: '网络错误', icon: 'none' })
    } finally {
      Taro.hideLoading()
    }
  }

  return (
    <View className='store-v2-container'>
      <View className='header-section'>
        <Box className='user-points-badge' onClick={() => Taro.navigateTo({ url: '/pages/history/index' })}>
          <Text className='coin-icon'>💰</Text>
          <Text className='points-val'>{totalPoints}</Text>
          <Text className='points-label'>我的积分 ⟩</Text>
        </Box>
      </View>

      <ScrollView scrollY className='store-scroll-view'>
        <View className='cards-wrapper'>
          <Grid column={2} gap={24}>
            {PRODUCTS.map(item => (
              <Card key={item.id} className='product-card-dux' shadow onClick={() => handleBuy(item)}>
                <View className={`icon-wrapper ${item.type}`}>
                  <Text className='emoji-icon'>{item.icon}</Text>
                </View>
                <Box padding className='content-wrapper'>
                  <Text className='product-name'>{item.name}</Text>
                  <Text className='product-desc'>{item.desc}</Text>
                  <Space align='baseline' className='price-tag'>
                    <Text className='price-num'>{item.points}</Text>
                    <Text className='price-unit'>积分</Text>
                  </Space>
                </Box>
                <Button className='buy-btn' type='primary' block radiusType='none'>
                  立即兑换
                </Button>
              </Card>
            ))}
          </Grid>
        </View>
      </ScrollView>
    </View>
  )
}
