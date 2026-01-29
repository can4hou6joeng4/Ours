import { View, Text, ScrollView, Button, Image } from '@tarojs/components'
import Taro, { useDidShow, eventCenter } from '@tarojs/taro'
import { useState, useEffect } from 'react'
import DuxGrid from '../../components/DuxGrid'
import DuxCard from '../../components/DuxCard'
import { getIconifyUrl } from '../../utils/assets'
import './index.scss'

export default function Store() {
  const [totalPoints, setTotalPoints] = useState(0)
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  useDidShow(() => {
    fetchData()
  })

  useEffect(() => {
    eventCenter.on('refreshStore', fetchData)
    return () => eventCenter.off('refreshStore', fetchData)
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [userRes, giftsRes]: any = await Promise.all([
        Taro.cloud.callFunction({ name: 'initUser' }),
        Taro.cloud.callFunction({ name: 'getGifts' })
      ])

      if (userRes.result.success) {
        setTotalPoints(userRes.result.user.totalPoints)
        // 简单判断：有伙伴且是发起绑定的人视为管理员，或者根据业务逻辑调整
        setIsAdmin(true)
      }

      if (giftsRes.result.success) {
        setProducts(giftsRes.result.gifts)
      }
    } catch (e) {
      console.error('获取数据失败', e)
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (e, item) => {
    e.stopPropagation()
    Taro.navigateTo({
      url: `/pages/gift-edit/index?id=${item._id}&data=${encodeURIComponent(JSON.stringify(item))}`
    })
  }

  const handleDelete = (e, item) => {
    e.stopPropagation()
    Taro.showModal({
      title: '确认删除',
      content: `确定要删除礼品“${item.name}”吗？`,
      success: async (res) => {
        if (res.confirm) {
          try {
            const result: any = await Taro.cloud.callFunction({
              name: 'manageGift',
              data: { action: 'delete', giftId: item._id }
            })
            if (result.result.success) {
              Taro.showToast({ title: '已删除' })
              fetchData()
            }
          } catch (e) {
            Taro.showToast({ title: '删除失败', icon: 'none' })
          }
        }
      }
    })
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
        fetchData()
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
          <View className='minimal-assets-bar' onClick={() => Taro.navigateTo({ url: '/pages/history/index' })}>
            <View className='asset-info'>
              <Text className='asset-label'>CURRENT ASSETS / 当前积分</Text>
              <View className='asset-value-row'>
                <Text className='asset-num'>{totalPoints}</Text>
              </View>
            </View>
            <View className='asset-btn'>
              <Text>明细 ⟩</Text>
            </View>
          </View>

          {isAdmin && (
            <View className='admin-actions'>
              <Button className='add-btn' onClick={() => Taro.navigateTo({ url: '/pages/gift-edit/index' })}>
                + 新增礼品
              </Button>
            </View>
          )}

          <View className='cards-wrapper'>
            {products.length === 0 && !loading ? (
              <View className='empty-state'>暂无礼品，请联系管理员添加</View>
            ) : (
              <DuxGrid column={2} gap={32}>
                {products.map(item => (
                  <DuxCard
                    key={item._id}
                    className='product-card-v4'
                    onClick={() => handleBuy(item)}
                    shadow={false}
                  >
                    <View className='card-top'>
                      {item.coverImg ? (
                        <Image src={item.coverImg} mode='aspectFill' className='product-image' />
                      ) : (
                        <View className='icon-circle'>
                          <Image src={getIconifyUrl('tabler:gift', '#D4B185')} className='iconify-inner' />
                        </View>
                      )}
                      {isAdmin && (
                        <View className='admin-tags'>
                          <View className='tag edit' onClick={(e) => handleEdit(e, item)}>编辑</View>
                          <View className='tag delete' onClick={(e) => handleDelete(e, item)}>删除</View>
                        </View>
                      )}
                    </View>
                    <View className='card-body'>
                      <Text className='p-name'>{item.name}</Text>
                      <Text className='p-desc'>{item.desc || '暂无描述'}</Text>
                      <View className='p-footer'>
                        <Text className='p-price'>{item.points}</Text>
                      </View>
                    </View>
                  </DuxCard>
                ))}
              </DuxGrid>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  )
}
