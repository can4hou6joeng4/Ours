import { View, Text, ScrollView, Button, Image, Input } from '@tarojs/components'
import Taro, { useDidShow, eventCenter } from '@tarojs/taro'
import { useState, useEffect, useMemo, useRef } from 'react'
import { Notify } from '@taroify/core'
import ProductCard from '../../components/ProductCard'
import EmptyState from '../../components/EmptyState'
import GiftEditSheet from '../../components/GiftEditSheet'
import ExchangeHistoryModal from '../../components/ExchangeHistoryModal'
import BindingSheet from '../../components/BindingSheet'
import SkeletonCard from '../../components/SkeletonCard'
import { requestSubscribe } from '../../utils/subscribe'
import { useUserStore } from '../../store'
import { useExchangeHistory } from '../../hooks'
import { getGifts as getGiftsApi, manageGift as manageGiftApi, buyItem as buyItemApi } from '../../services'
import type { Gift, GiftEditData } from '../../types'
import './index.scss'

const DATA_CACHE_DURATION = 30 * 1000

export default function Store() {
  const { user, partnerId, fetchUser } = useUserStore()
  const totalPoints = user?.totalPoints || 0
  const hasPartner = !!partnerId

  const [products, setProducts] = useState<Gift[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [showManageMenu, setShowManageMenu] = useState(false)
  const [showEditSheet, setShowEditSheet] = useState(false)
  const [selectedGift, setSelectedGift] = useState<Gift | null>(null)
  const [editData, setEditData] = useState<GiftEditData>({
    name: '',
    points: '',
    coverImg: '',
    desc: ''
  })
  const [saving, setSaving] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showExchangeHistory, setShowExchangeHistory] = useState(false)
  const [showBindingSheet, setShowBindingSheet] = useState(false)

  const {
    historyList, historyLoading, hasMoreHistory, historyFilter,
    loadHistory, changeFilter,
  } = useExchangeHistory()

  const lastFetchTime = useRef<number>(0)
  const dataLoadingRef = useRef(false)

  useDidShow(() => {
    const now = Date.now()
    if (products.length > 0 && now - lastFetchTime.current < DATA_CACHE_DURATION) {
      return
    }
    fetchData()
  })

  useEffect(() => {
    eventCenter.on('refreshStore', fetchData)
    return () => { eventCenter.off('refreshStore', fetchData) }
  }, [])

  const { leftCol, rightCol } = useMemo(() => ({
    leftCol: products.filter((_, i) => i % 2 === 0),
    rightCol: products.filter((_, i) => i % 2 !== 0)
  }), [products])

  const handleShowExchangeHistory = () => {
    setShowExchangeHistory(true)
    loadHistory({ reset: true })
  }

  const fetchData = async () => {
    if (dataLoadingRef.current) return

    dataLoadingRef.current = true
    setLoading(true)
    try {
      const [, giftsResult] = await Promise.all([
        fetchUser(),
        getGiftsApi()
      ])

      setIsAdmin(true)

      if (giftsResult.success) {
        setProducts(giftsResult.gifts || [])
        lastFetchTime.current = Date.now()
      }
    } catch (e) {
      console.error('获取数据失败', e)
    } finally {
      dataLoadingRef.current = false
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
      content: `确定要将"${item.name}"从货架移除吗？此操作不可撤销。`,
      confirmColor: '#FF4D4F',
      success: async (res) => {
        if (res.confirm) {
          Taro.showLoading({ title: '正在移除...' })
          try {
            const result = await manageGiftApi({ action: 'delete', giftId: item._id })
            if (result.success) {
              Taro.showToast({ title: '已成功移除', icon: 'success' })
              fetchData()
            }
          } catch (e) {
            Notify.open({ type: 'danger', message: '删除失败' })
          } finally {
            Taro.hideLoading()
          }
        }
      }
    })
  }

  const handleUpdateGift = async (): Promise<boolean> => {
    const points = Number(editData.points)
    const isValidPoints = Number.isInteger(points) && points > 0
    if (saving || !editData.name || !isValidPoints) {
      if (!saving) Notify.open({ type: 'warning', message: '信息不全' })
      return false
    }

    setSaving(true)
    try {
      await requestSubscribe(['GIFT_USED'])

      const isEdit = !!selectedGift
      const result = await manageGiftApi({
        action: isEdit ? 'update' : 'add',
        giftId: isEdit ? selectedGift._id : undefined,
        giftData: { ...editData, points }
      })

      if (result.success) {
        Taro.showToast({ title: isEdit ? '更新成功' : '添加成功' })
        setShowEditSheet(false)
        fetchData()
      } else {
        Notify.open({ type: 'danger', message: result.message || result.error || '保存失败' })
      }
    } catch (e) {
      Notify.open({ type: 'danger', message: '保存失败' })
    } finally {
      setSaving(false)
    }

    return true
  }

  const handleBuy = async (item) => {
    if (isSubmitting || totalPoints < item.points) {
      if (!isSubmitting) Notify.open({ type: 'warning', message: '积分不足' })
      return
    }

    const confirm = await Taro.showModal({
      title: '确认兑换',
      content: `确定要花费 ${item.points} 积分兑换"${item.name}"吗？`
    })

    if (!confirm.confirm) return

    setIsSubmitting(true)
    Taro.showLoading({ title: '处理中...' })
    try {
      const result = await buyItemApi({ giftId: item._id })

      if (result.success) {
        Taro.showToast({ title: '兑换成功', icon: 'success' })
        if (typeof result.balanceAfter === 'number') {
          useUserStore.getState().updateProfile({ totalPoints: result.balanceAfter })
        } else {
          fetchData()
        }
      } else {
        Notify.open({ type: 'danger', message: result.error || '兑换失败' })
      }
    } catch (e) {
      Notify.open({ type: 'danger', message: '网络错误' })
    } finally {
      Taro.hideLoading()
      setTimeout(() => setIsSubmitting(false), 200)
    }
  }

  const renderProduct = (item) => (
    <ProductCard
      key={item._id}
      item={item}
      onBuy={handleBuy}
      onLongPress={handleLongPress}
    />
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
              onClick={() => {
                if (!hasPartner) {
                  setShowBindingSheet(true)
                  return
                }
                Taro.navigateTo({ url: '/pages/history/index' })
              }}
            >
              明细 ⟩
            </View>
          </View>

          {isAdmin && hasPartner && (
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
                onAction={() => setShowBindingSheet(true)}
              />
            ) : (
              <SkeletonCard loading={loading} row={4} className='masonry-skeleton'>
                {products.length === 0 ? (
                  <EmptyState
                    icon='tabler:package-off'
                    title='货架空空如也'
                    desc='点击上方"新增礼品"按钮丰富商店内容吧'
                  />
                ) : (
                  <View className='masonry-grid'>
                    <View className='masonry-column'>{leftCol.map(renderProduct)}</View>
                    <View className='masonry-column'>{rightCol.map(renderProduct)}</View>
                  </View>
                )}
              </SkeletonCard>
            )}
          </View>
        </View>
      </ScrollView>

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

      <GiftEditSheet
        visible={showEditSheet}
        isEdit={!!selectedGift}
        editData={editData}
        saving={saving}
        onClose={() => setShowEditSheet(false)}
        onUpdate={setEditData}
        onSave={handleUpdateGift}
      />

      <ExchangeHistoryModal
        visible={showExchangeHistory}
        historyList={historyList}
        loading={historyLoading}
        hasMore={hasMoreHistory}
        filter={historyFilter}
        onClose={() => setShowExchangeHistory(false)}
        onFilterChange={changeFilter}
        onLoadMore={() => loadHistory()}
      />

      <BindingSheet
        visible={showBindingSheet}
        onClose={() => setShowBindingSheet(false)}
        onSuccess={() => {
          setShowBindingSheet(false)
          fetchData()
        }}
      />
    </View>
  )
}
