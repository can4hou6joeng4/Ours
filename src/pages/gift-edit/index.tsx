import { useState, useEffect } from 'react'
import Taro, { useRouter } from '@tarojs/taro'
import { View, Text, Image, ScrollView } from '@tarojs/components'
import { Button, Input } from '@taroify/core'
import { requestSubscribe } from '../../utils/subscribe'
import { getIconifyUrl } from '../../utils/assets'
import { uploadImage } from '../../utils/upload'
import { manageGift as manageGiftApi } from '../../services'
import './index.scss'

export default function GiftEdit() {
  const router = useRouter()
  const isEdit = !!router.params.id

  const [loading, setLoading] = useState(false)
  const [giftData, setGiftData] = useState({
    name: '',
    points: '',
    coverImg: '',
    desc: ''
  })

  useEffect(() => {
    if (isEdit && router.params.data) {
      try {
        const data = JSON.parse(decodeURIComponent(router.params.data))
        setGiftData({
          name: data.name || '',
          points: String(data.points || ''),
          coverImg: data.coverImg || '',
          desc: data.desc || ''
        })
      } catch (e) {
        console.error('解析数据失败', e)
      }
    }
  }, [isEdit, router.params.data])

  const handleUploadImg = async () => {
    const fileID = await uploadImage('gifts', { loadingText: '处理中...' })
    if (fileID) {
      setGiftData({ ...giftData, coverImg: fileID })
    }
  }

  const handleSave = async () => {
    const points = Number(giftData.points)
    const isValidPoints = Number.isInteger(points) && points > 0
    if (!giftData.name || !isValidPoints) {
      Taro.showToast({ title: '请填写完整信息', icon: 'none' })
      return
    }

    setLoading(true)
    try {
      await requestSubscribe(['GIFT_USED'])

      const result = await manageGiftApi({
        action: isEdit ? 'update' : 'add',
        giftId: router.params.id,
        giftData: { ...giftData, points }
      })

      if (result.success) {
        Taro.showToast({ title: '保存成功' })
        Taro.eventCenter.trigger('refreshStore')
        setTimeout(() => Taro.navigateBack(), 1500)
      } else {
        throw new Error(result.message || result.error || '保存失败')
      }
    } catch (e: any) {
      Taro.showToast({ title: e.message || '保存失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <View className='gift-edit-container'>
      <ScrollView scrollY className='edit-scroll-view'>
        <View className='scroll-content'>
          <View className='section-group core-info-section'>
            <View className='left-upload' onClick={handleUploadImg}>
              {giftData.coverImg ? (
                <Image src={giftData.coverImg} mode='aspectFill' className='preview-img' />
              ) : (
                <View className='upload-placeholder'>
                  <Image src={getIconifyUrl('tabler:camera', '#D4B185')} className='upload-icon' />
                  <Text className='upload-text'>添加图片</Text>
                </View>
              )}
            </View>

            <View className='right-inputs'>
              <View className='form-item'>
                <Text className='label'>物品名称 *</Text>
                <Input
                  className='custom-input'
                  placeholder='例如：洗碗券'
                  value={giftData.name}
                  onChange={e => setGiftData({ ...giftData, name: e.detail.value })}
                />
              </View>
              <View className='form-item'>
                <Text className='label'>所需积分 *</Text>
                <Input
                  className='custom-input'
                  type='number'
                  placeholder='0'
                  value={giftData.points}
                  onChange={e => setGiftData({ ...giftData, points: e.detail.value })}
                />
              </View>
            </View>
          </View>

          <View className='section-group'>
            <View className='section-header'>
              <View className='accent' />
              <Text className='title'>详细描述</Text>
            </View>
            <View className='form-item'>
              <Input
                className='custom-input'
                placeholder='简单描述一下礼品吧'
                value={giftData.desc}
                onChange={e => setGiftData({ ...giftData, desc: e.detail.value })}
              />
            </View>
          </View>
        </View>
      </ScrollView>

      <View className='footer-btns'>
        <Button className='btn reset' onClick={() => Taro.navigateBack()}>取消</Button>
        <Button className='btn save' loading={loading} onClick={handleSave}>保存</Button>
      </View>
    </View>
  )
}
