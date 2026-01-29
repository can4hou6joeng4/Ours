import { View, Text, ScrollView, Button, Image } from '@tarojs/components'
import Taro, { useDidShow, eventCenter } from '@tarojs/taro'
import { useState, useEffect } from 'react'
import DuxGrid from '../../components/DuxGrid'
import DuxCard from '../../components/DuxCard'
import EmptyState from '../../components/EmptyState'
import { getIconifyUrl } from '../../utils/assets'
import './index.scss'

export default function Store() {
  const [totalPoints, setTotalPoints] = useState(0)
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [hasPartner, setHasPartner] = useState(false)

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
        const user = userRes.result.user
        setTotalPoints(user.totalPoints || 0)
        setHasPartner(!!user.partnerId)
        setIsAdmin(true) // 这里的逻辑可以根据需求精细化
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

  const handleLongPress = (item) => {
    if (!isAdmin) return

    Taro.showActionSheet({
      itemList: ['编辑礼品', '删除礼品'],
      itemColor: '#333',
      success: (res) => {
        if (res.tapIndex === 0) {
          // 编辑
          Taro.navigateTo({
            url: `/pages/gift-edit/index?id=${item._id}&data=${encodeURIComponent(JSON.stringify(item))}`
          })
        } else if (res.tapIndex === 1) {
          // 删除
          handleDelete(item)
        }
      }
    })
  }

  const handleDelete = (item) => {
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

  // 将产品列表拆分为两列以实现瀑布流
  const leftCol = products.filter((_, i) => i % 2 === 0)
  const rightCol = products.filter((_, i) => i % 2 !== 0)

  const renderProduct = (item) => (
    <DuxCard
      key={item._id}
      className='product-card-v4 masonry-item'
      shadow={false}
    >
      <View
        className='card-inner-touch'
        onClick={() => handleBuy(item)}
        onLongPress={() => handleLongPress(item)}
      >
        <View className='card-top'>
          {item.coverImg ? (
            <Image src={item.coverImg} mode='widthFix' className='product-image' />
          ) : (
            <View className='icon-circle'>
              <Image src={getIconifyUrl('tabler:gift', '#D4B185')} className='iconify-inner' />
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
      </View>
    </DuxCard>
  )

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
            {!hasPartner ? (
              <EmptyState
                icon='tabler:link'
                title='兑换中心尚未开启'
                desc='绑定另一半后，可以使用积分兑换心仪的礼品'
                btnText='去绑定'
                onAction={() => Taro.navigateTo({ url: '/pages/binding/index' })}
              />
            ) : products.length === 0 && !loading ? (
              <EmptyState
                icon='tabler:package-off'
                title='货架空空如也'
                desc='点击上方“新增礼品”按钮丰富商店内容吧'
              />
            ) : (
              <View className='masonry-grid'>
                <View className='masonry-column'>{leftCol.map(renderProduct)}</View>
                <View className='masonry-column'>{rightCol.map(renderProduct)}</View>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  )
}
