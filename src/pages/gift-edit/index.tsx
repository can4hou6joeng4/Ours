import { useState, useEffect } from 'react'
import Taro, { useRouter } from '@tarojs/taro'
import { View, Text, Image, ScrollView } from '@tarojs/components'
import { Button, Input } from '@taroify/core'
import { requestSubscribe } from '../../utils/subscribe'
import { getIconifyUrl } from '../../utils/assets'
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
    try {
      const res = await Taro.chooseImage({
        count: 1,
        sizeType: ['compressed'], // 优先使用压缩图
        sourceType: ['album', 'camera']
      })
      let tempFilePath = res.tempFilePaths[0]

      Taro.showLoading({ title: '处理中...' })

      // 1. 前端质量压缩：适配缩略图尺寸，减少上传体积
      const compressRes = await Taro.compressImage({
        src: tempFilePath,
        quality: 80 // 压缩质量
      })
      tempFilePath = compressRes.tempFilePath

      // 2. 上传到云存储
      const uploadRes = await Taro.cloud.uploadFile({
        cloudPath: `gifts/${Date.now()}-${Math.random().toString(36).slice(-6)}.png`,
        filePath: tempFilePath
      })

      setGiftData({ ...giftData, coverImg: uploadRes.fileID })
      Taro.showToast({ title: '上传并压缩成功' })
    } catch (e) {
      console.error('上传失败', e)
    } finally {
      Taro.hideLoading()
    }
  }

  const handleSave = async () => {
    if (!giftData.name || !giftData.points) {
      Taro.showToast({ title: '请填写完整信息', icon: 'none' })
      return
    }

    setLoading(true)
    try {
      // 引导订阅 (用于接收后续对方兑换礼品的通知)
      await requestSubscribe(['GIFT_USED'])

      const res = await Taro.cloud.callFunction({
        name: 'manageGift',
        data: {
          action: isEdit ? 'update' : 'add',
          giftId: router.params.id,
          giftData: {
            ...giftData,
            points: Number(giftData.points)
          }
        }
      })

      const result = res.result as any
      if (result.success) {
        Taro.showToast({ title: '保存成功' })
        Taro.eventCenter.trigger('refreshStore')
        setTimeout(() => Taro.navigateBack(), 1500)
      } else {
        throw new Error(result.error)
      }
    } catch (e) {
      Taro.showToast({ title: e.message || '保存失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <View className='gift-edit-container'>
      <ScrollView scrollY className='edit-scroll-view'>
        <View className='scroll-content'>
          {/* 核心信息区块：图左文右布局 */}
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
