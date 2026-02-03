import { View, Text, ScrollView, Button, Image, Input } from '@tarojs/components'
import Taro, { useDidShow, useReachBottom, eventCenter } from '@tarojs/taro'
import { useState, useEffect } from 'react'
import { Dialog, Toast } from '@taroify/core'
import DuxGrid from '../../components/DuxGrid'
import DuxCard from '../../components/DuxCard'
import EmptyState from '../../components/EmptyState'
import GiftEditSheet from '../../components/GiftEditSheet'
import ExchangeHistoryModal from '../../components/ExchangeHistoryModal'
import { getIconifyUrl } from '../../utils/assets'
import { requestSubscribe } from '../../utils/subscribe'
import dayjs from 'dayjs'
import './index.scss'

export default function Store() {
  const [totalPoints, setTotalPoints] = useState(0)
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [hasPartner, setHasPartner] = useState(false)
  const [showManageMenu, setShowManageMenu] = useState(false)
  const [showEditSheet, setShowEditSheet] = useState(false)
  const [selectedGift, setSelectedGift] = useState<any>(null)
  const [editData, setEditData] = useState({
    name: '',
    points: '',
    coverImg: '',
    desc: ''
  })
  const [saving, setSaving] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showExchangeHistory, setShowExchangeHistory] = useState(false)
  const [historyList, setHistoryList] = useState<any[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyPage, setHistoryPage] = useState(1)
  const [hasMoreHistory, setHasMoreHistory] = useState(true)
  const [historyFilter, setHistoryFilter] = useState<'all' | 'unused' | 'used'>('all')

  useDidShow(() => {
    fetchData()
  })

  useEffect(() => {
    eventCenter.on('refreshStore', fetchData)
    return () => { eventCenter.off('refreshStore', fetchData) }
  }, [])

  // 加载兑换历史数据
  const loadExchangeHistory = async (reset = false) => {
    if (!hasMoreHistory && !reset) return

    setHistoryLoading(true)
    try {
      const page = reset ? 1 : historyPage
      const { result }: any = await Taro.cloud.callFunction({
        name: 'getExchangeHistory',
        data: { page, pageSize: 20, filter: historyFilter }
      })

      if (result.success) {
        if (reset) {
          setHistoryList(result.data)
          setHistoryPage(1)
        } else {
          setHistoryList(prev => [...prev, ...result.data])
        }
        setHasMoreHistory(result.data.length >= 20)
        if (!reset) {
          setHistoryPage(prev => prev + 1)
        }
      }
    } catch (e) {
      console.error('加载兑换历史失败', e)
    } finally {
      setHistoryLoading(false)
    }
  }

  // 打开兑换历史弹窗
  const handleShowExchangeHistory = () => {
    setShowExchangeHistory(true)
    loadExchangeHistory(true)
  }

  // 切换历史筛选
  const handleHistoryFilterChange = (filter: 'all' | 'unused' | 'used') => {
    setHistoryFilter(filter)
    loadExchangeHistory(true)
  }

  // 触底加载更多历史 (由组件内部处理，不再依赖页面级 useReachBottom 触发弹窗内滚动)
  // useReachBottom(() => {
  //   if (showExchangeHistory && hasMoreHistory && !historyLoading) {
  //     loadExchangeHistory(false)
  //   }
  // })

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
    setSelectedGift(item)
    setShowManageMenu(true)
  }

  const handleAction = (type: 'edit' | 'delete') => {
    setShowManageMenu(false)
    if (type === 'edit') {
      setEditData({
        name: selectedGift.name || '',
        points: String(selectedGift.points || ''),
        coverImg: selectedGift.coverImg || '',
        desc: selectedGift.desc || ''
      })
      setShowEditSheet(true)
    } else {
      handleDeleteConfirm(selectedGift)
    }
  }

  const handleDeleteConfirm = (item) => {
    Taro.showModal({
      title: '确认删除',
      content: `确定要将“${item.name}”从货架移除吗？此操作不可撤销。`,
      confirmColor: '#FF4D4F',
      success: async (res) => {
        if (res.confirm) {
          Taro.showLoading({ title: '正在移除...' })
          try {
            const result: any = await Taro.cloud.callFunction({
              name: 'manageGift',
              data: { action: 'delete', giftId: item._id }
            })
            if (result.result.success) {
              Taro.showToast({ title: '已成功移除', icon: 'success' })
              fetchData()
            }
          } catch (e) {
            Taro.showToast({ title: '删除失败', icon: 'none' })
          } finally {
            Taro.hideLoading()
          }
        }
      }
    })
  }

  const handleUpdateGift = async () => {
    if (saving || !editData.name || !editData.points) {
      if (!saving) Taro.showToast({ title: '信息不全', icon: 'none' })
      return
    }

    setSaving(true)
    try {
      // 引导订阅 (用于接收后续对方兑换礼品的通知)
      await requestSubscribe(['GIFT_USED'])

      const isEdit = !!selectedGift
      const res: any = await Taro.cloud.callFunction({
        name: 'manageGift',
        data: {
          action: isEdit ? 'update' : 'add',
          giftId: isEdit ? selectedGift._id : undefined,
          giftData: { ...editData, points: Number(editData.points) }
        }
      })

      if (res.result.success) {
        Taro.showToast({ title: isEdit ? '更新成功' : '添加成功' })
        setShowEditSheet(false)
        fetchData()
      }
    } catch (e) {
      Taro.showToast({ title: '保存失败', icon: 'none' })
    } finally {
      setSaving(false)
    }
  }

  const handleBuy = async (item) => {
    if (isSubmitting || totalPoints < item.points) {
      if (!isSubmitting) Taro.showToast({ title: '积分不足', icon: 'error' })
      return
    }

    const confirm = await Taro.showModal({
      title: '确认兑换',
      content: `确定要花费 ${item.points} 积分兑换“${item.name}”吗？`
    })

    if (!confirm.confirm) return

    setIsSubmitting(true)
    Taro.showLoading({ title: '处理中...' })
    try {
      const { result }: any = await Taro.cloud.callFunction({
        name: 'buyItem',
        data: {
          item: {
            name: item.name,
            points: item.points,
            image: item.coverImg // 关键修复：补全图片字段传递
          }
        }
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
      setTimeout(() => setIsSubmitting(false), 200)
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
          {item.coverImg && /^cloud:\/\//.test(item.coverImg.trim()) ? (
            <Image
              src={item.coverImg.trim()}
              mode='widthFix'
              className='product-image'
              onError={(e) => console.error('图片加载失败:', item.name, e)}
            />
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
            <Text className='p-price'>{item.points} 积分</Text>
          </View>
        </View>
      </View>
    </DuxCard>
  )

  return (
    <View className='store-v2-container'>
      <ScrollView scrollY className='store-scroll-view'>
        <View className='store-inner-content'>
          <View className='minimal-assets-bar'>
            <View className='asset-info'>
              <Text className='asset-label'>CURRENT ASSETS / 当前积分</Text>
              <View className='asset-value-row'>
                <Text className='asset-num'>{totalPoints}</Text>
              </View>
            </View>
            <View
              className='asset-btn'
              onClick={() => Taro.navigateTo({ url: '/pages/history/index' })}
            >
              明细 ⟩
            </View>
          </View>

          {isAdmin && (
            <View className='admin-actions'>
              <Button className='add-btn' onClick={() => {
                setSelectedGift(null)
                setEditData({ name: '', points: '', coverImg: '', desc: '' })
                setShowEditSheet(true)
              }}>
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
            ) : loading ? (
              <View className='skeleton-grid'>
                <View className='skeleton-column'>
                  {[1, 2].map(i => (
                    <View key={i} className='skeleton-card'>
                      <View className='skeleton-image shimmer' />
                      <View className='skeleton-info'>
                        <View className='skeleton-line name shimmer' />
                        <View className='skeleton-line desc shimmer' />
                        <View className='skeleton-line price shimmer' />
                      </View>
                    </View>
                  ))}
                </View>
                <View className='skeleton-column'>
                  {[3, 4].map(i => (
                    <View key={i} className='skeleton-card'>
                      <View className='skeleton-image shimmer' />
                      <View className='skeleton-info'>
                        <View className='skeleton-line name shimmer' />
                        <View className='skeleton-line desc shimmer' />
                        <View className='skeleton-line price shimmer' />
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            ) : products.length === 0 ? (
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

      {/* 礼品管理毛玻璃菜单 (已重塑为名片式风格) */}
      {showManageMenu && (
        <View className='masonry-manage-modal' onClick={() => setShowManageMenu(false)}>
          <View className='manage-card' onClick={e => e.stopPropagation()}>
            <View className='card-header'>
              <Text className='manage-title'>礼品管理</Text>
              <Text className='gift-name-sub'>{selectedGift?.name}</Text>
            </View>

            <View className='card-body'>
              <View className='manage-item edit' onClick={() => handleAction('edit')}>
                <Text className='item-text'>编辑礼品信息</Text>
              </View>
              <View className='manage-item delete' onClick={() => handleAction('delete')}>
                <Text className='item-text'>从货架删除</Text>
              </View>
            </View>
          </View>
        </View>
      )}
      {/* 礼品编辑底部抽屉 */}
      <GiftEditSheet
        visible={showEditSheet}
        isEdit={!!selectedGift}
        editData={editData}
        saving={saving}
        onClose={() => setShowEditSheet(false)}
        onUpdate={setEditData}
        onSave={handleUpdateGift}
      />

      {/* 兑换历史底部弹窗 */}
      <ExchangeHistoryModal
        visible={showExchangeHistory}
        historyList={historyList}
        loading={historyLoading}
        hasMore={hasMoreHistory}
        filter={historyFilter}
        onClose={() => setShowExchangeHistory(false)}
        onFilterChange={handleHistoryFilterChange}
        onLoadMore={() => loadExchangeHistory(false)}
      />
    </View>
  )
}
