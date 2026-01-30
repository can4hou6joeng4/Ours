import { View, Text, ScrollView, Button, Image, Input } from '@tarojs/components'
import Taro, { useDidShow, eventCenter } from '@tarojs/taro'
import { useState, useEffect } from 'react'
import { Dialog, Toast } from '@taroify/core'
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

  const handleUploadImg = async () => {
    try {
      const res = await Taro.chooseImage({ count: 1, sizeType: ['compressed'] })
      let tempFilePath = res.tempFilePaths[0]
      Taro.showLoading({ title: '处理图片...' })

      const compressRes = await Taro.compressImage({ src: tempFilePath, quality: 80 })
      tempFilePath = compressRes.tempFilePath

      const uploadRes = await Taro.cloud.uploadFile({
        cloudPath: `gifts/${Date.now()}-${Math.random().toString(36).slice(-6)}.png`,
        filePath: tempFilePath
      })

      setEditData({ ...editData, coverImg: uploadRes.fileID })
      Taro.showToast({ title: '图片已上传' })
    } catch (e) {
      console.error('上传失败', e)
    } finally {
      Taro.hideLoading()
    }
  }

  const handleUpdateGift = async () => {
    if (!editData.name || !editData.points) {
      Taro.showToast({ title: '信息不全', icon: 'none' })
      return
    }

    setSaving(true)
    try {
      const res: any = await Taro.cloud.callFunction({
        name: 'manageGift',
        data: {
          action: 'update',
          giftId: selectedGift._id,
          giftData: { ...editData, points: Number(editData.points) }
        }
      })

      if (res.result.success) {
        Taro.showToast({ title: '更新成功' })
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
          {item.coverImg && item.coverImg.trim().startsWith('cloud://') ? (
            <Image src={item.coverImg.trim()} mode='widthFix' className='product-image' />
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
      {showEditSheet && (
        <View className='edit-sheet-root' onClick={() => !saving && setShowEditSheet(false)}>
          <View className='sheet-content' onClick={e => e.stopPropagation()}>
            <View className='sheet-header'>
              <Text className='title'>编辑礼品</Text>
              <View className='close' onClick={() => !saving && setShowEditSheet(false)}>×</View>
            </View>

            <ScrollView scrollY className='sheet-body'>
              <View className='form-group'>
                <View className='image-upload-box' onClick={handleUploadImg}>
                  {editData.coverImg ? (
                    <Image src={editData.coverImg} mode='aspectFill' className='preview' />
                  ) : (
                    <View className='placeholder'>
                      <Image src={getIconifyUrl('tabler:camera', '#D4B185')} className='icon' />
                      <Text className='txt'>更换图片</Text>
                    </View>
                  )}
                </View>

                <View className='inputs-area'>
                  <View className='input-item'>
                    <Text className='label'>物品名称</Text>
                    <Input
                      className='input'
                      value={editData.name}
                      onInput={e => setEditData({ ...editData, name: e.detail.value })}
                    />
                  </View>
                  <View className='input-item'>
                    <Text className='label'>所需积分</Text>
                    <Input
                      className='input'
                      type='number'
                      value={editData.points}
                      onInput={e => setEditData({ ...editData, points: e.detail.value })}
                    />
                  </View>
                </View>
              </View>

              <View className='input-item full'>
                <Text className='label'>详细描述</Text>
                <Input
                  className='input'
                  value={editData.desc}
                  placeholder='简单描述一下礼品...'
                  onInput={e => setEditData({ ...editData, desc: e.detail.value })}
                />
              </View>
            </ScrollView>

            <View className='sheet-footer'>
              <Button
                className='save-btn'
                loading={saving}
                onClick={handleUpdateGift}
              >
                保存修改
              </Button>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
