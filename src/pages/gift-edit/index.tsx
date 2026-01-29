import { useState, useEffect } from 'react'
import Taro, { useRouter } from '@tarojs/taro'
import { View, Text, Input, Button, Image, Picker } from '@tarojs/components'
import { getIconifyUrl } from '../../utils/assets'
import './index.scss'

export default function GiftEdit() {
  const router = useRouter()
  const isEdit = !!router.params.id

  const [loading, setLoading] = useState(false)
  const [giftData, setGiftData] = useState({
    name: '',
    points: '',
    category: 'entertainment',
    coverImg: '',
    desc: ''
  })

  const categories = [
    { id: 'entertainment', name: '电子产品' },
    { id: 'life', name: '生活用品' },
    { id: 'surprise', name: '惊喜奖励' },
    { id: 'food', name: '美食佳饮' }
  ]

  useEffect(() => {
    if (isEdit && router.params.data) {
      try {
        const data = JSON.parse(decodeURIComponent(router.params.data))
        setGiftData({
          ...data,
          points: String(data.points)
        })
      } catch (e) {
        console.error('解析数据失败', e)
      }
    }
  }, [isEdit, router.params.data])

  const handleUploadImg = async () => {
    try {
      const res = await Taro.chooseImage({ count: 1 })
      const tempFilePath = res.tempFilePaths[0]

      Taro.showLoading({ title: '上传中...' })
      const uploadRes = await Taro.cloud.uploadFile({
        cloudPath: `gifts/${Date.now()}-${Math.random().toString(36).slice(-6)}.png`,
        filePath: tempFilePath
      })

      setGiftData({ ...giftData, coverImg: uploadRes.fileID })
      Taro.showToast({ title: '上传成功' })
    } catch (e) {
      console.error(e)
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
      <View className='section-group'>
        <View className='section-header'>
          <View className='accent' />
          <Text className='title'>物品图片</Text>
        </View>
        <View className='upload-area' onClick={handleUploadImg}>
          {giftData.coverImg ? (
            <Image src={giftData.coverImg} mode='aspectFill' className='preview-img' />
          ) : (
            <View className='upload-placeholder'>
              <Image src={getIconifyUrl('tabler:cloud-upload', '#D4B185')} className='upload-icon' />
              <Text className='upload-text'>点击上传图片</Text>
            </View>
          )}
        </View>
      </View>

      <View className='section-group'>
        <View className='section-header'>
          <View className='accent' />
          <Text className='title'>基础信息</Text>
        </View>
        <View className='form-item'>
          <Text className='label'>物品名称 *</Text>
          <Input
            className='input'
            placeholder='请输入物品名称'
            value={giftData.name}
            onInput={e => setGiftData({ ...giftData, name: e.detail.value })}
          />
        </View>
        <View className='form-item'>
          <Text className='label'>分类 *</Text>
          <Picker
            mode='selector'
            range={categories}
            rangeKey='name'
            onChange={e => setGiftData({ ...giftData, category: categories[e.detail.value].id })}
          >
            <View className='picker-value'>
              <Text style={{ color: giftData.category ? '#333' : '#999' }}>
                {categories.find(c => c.id === giftData.category)?.name || '请选择分类'}
              </Text>
              <Text className='arrow'>▾</Text>
            </View>
          </Picker>
        </View>
      </View>

      <View className='section-group'>
        <View className='section-header'>
          <View className='accent' />
          <Text className='title'>详细属性</Text>
        </View>
        <View className='form-item'>
          <Text className='label'>所需积分 *</Text>
          <Input
            className='input'
            type='number'
            placeholder='请输入积分数值'
            value={giftData.points}
            onInput={e => setGiftData({ ...giftData, points: e.detail.value })}
          />
        </View>
        <View className='form-item'>
          <Text className='label'>物品描述</Text>
          <Input
            className='input'
            placeholder='简单描述一下礼品吧'
            value={giftData.desc}
            onInput={e => setGiftData({ ...giftData, desc: e.detail.value })}
          />
        </View>
      </View>

      <View className='footer-btns'>
        <Button className='btn reset' onClick={() => Taro.navigateBack()}>取消</Button>
        <Button className='btn save' loading={loading} onClick={handleSave}>保存</Button>
      </View>
    </View>
  )
}
