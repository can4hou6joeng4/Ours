import { View, Text, ScrollView, Button, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import DuxGrid from '../../components/DuxGrid'
import DuxCard from '../../components/DuxCard'
import { getIconifyUrl, getPexelsUrl } from '../../utils/assets'
import './index.scss'

const PRODUCTS = [
  {
    id: 1,
    name: '电影日',
    points: 500,
    desc: '一起看一场想看的电影',
    icon: 'tabler:movie',
    type: 'movie',
    theme: '#FF6B00',
    bgColor: '#ffffff'
  },
  {
    id: 2,
    name: '家务抵用券',
    points: 300,
    desc: '对方帮你分担一次家务',
    icon: 'tabler:vacuum-cleaner',
    type: 'chore',
    theme: '#FF6B00',
    bgColor: '#ffffff'
  },
  {
    id: 3,
    name: '整蛊盲盒',
    points: 200,
    desc: '随机触发一个有趣的整蛊',
    icon: 'tabler:gift',
    type: 'box',
    theme: '#FF6B00',
    bgColor: '#ffffff'
  },
  {
    id: 4,
    name: '奶茶自由',
    points: 150,
    desc: '获得一杯心仪的奶茶',
    icon: 'tabler:cup',
    type: 'tea',
    theme: '#FF6B00',
    bgColor: '#ffffff'
  },
  {
    id: 5,
    name: '免死金牌',
    points: 1000,
    desc: '犯错时可抵消一次惩罚',
    icon: 'tabler:medal',
    type: 'medal',
    theme: '#FF6B00',
    bgColor: '#ffffff'
  }
]

const CATEGORIES = [
  { id: 'all', name: '全部', icon: 'tabler:apps', color: '#7B61FF' },
  { id: 'movie', name: '娱乐', icon: 'tabler:device-tv', color: '#3B82F6' },
  { id: 'chore', name: '生活', icon: 'tabler:home-heart', color: '#10B981' },
  { id: 'gift', name: '惊喜', icon: 'tabler:gift', color: '#F59E0B' },
]

export default function Store() {
  const [totalPoints, setTotalPoints] = useState(0)
  const [activeTab, setActiveTab] = useState('all')

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
      <ScrollView scrollY className='store-scroll-view'>
        <View className='store-inner-content'>
          {/* 资产看板 (理物风格) */}
          <View className='minimal-assets-bar' onClick={() => Taro.navigateTo({ url: '/pages/history/index' })}>
            <View className='asset-info'>
              <Text className='asset-num'>{totalPoints}</Text>
              <Text className='asset-label'>总资产积分</Text>
            </View>
            <View className='asset-info'>
              <Text className='asset-num'>0</Text>
              <Text className='asset-label'>今日变动</Text>
            </View>
          </View>

          <View className='cards-wrapper'>
            <DuxGrid column={2} gap={24}>
              {PRODUCTS.map(item => (
                <DuxCard
                  key={item.id}
                  className='product-card-v4'
                  onClick={() => handleBuy(item)}
                  style={{ backgroundColor: item.bgColor }}
                  shadow={false}
                >
                  <View className='card-top'>
                    <View className='icon-circle' style={{ backgroundColor: '#ffffff' }}>
                      <Image src={getIconifyUrl(item.icon, item.theme)} className='iconify-inner' />
                    </View>
                  </View>
                  <View className='card-body'>
                    <Text className='p-name'>{item.name}</Text>
                    <Text className='p-desc'>{item.desc}</Text>
                    <View className='p-footer'>
                      <Text className='p-price' style={{ color: item.theme }}>{item.points} 💰</Text>
                    </View>
                  </View>
                </DuxCard>
              ))}
            </DuxGrid>
          </View>
        </View>
      </ScrollView>
    </View>
  )
}
