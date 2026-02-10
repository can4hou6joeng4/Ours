import { View, Text, ScrollView, Image } from '@tarojs/components'
import { Button, Input } from '@taroify/core'
import Taro from '@tarojs/taro'
import React from 'react'
import { getIconifyUrl } from '../../utils/assets'
import './index.scss'

interface GiftEditSheetProps {
  visible: boolean
  isEdit: boolean
  editData: {
    name: string
    points: string
    coverImg: string
    desc: string
  }
  saving: boolean
  onClose: () => void
  onUpdate: (data: any) => void
  onSave: () => void
}

const GiftEditSheet: React.FC<GiftEditSheetProps> = ({
  visible,
  isEdit,
  editData,
  saving,
  onClose,
  onUpdate,
  onSave
}) => {
  const [previewUrl, setPreviewUrl] = React.useState('')

  // 当 editData.coverImg 变化时，转换为临时链接用于预览
  React.useEffect(() => {
    if (editData.coverImg && editData.coverImg.startsWith('cloud://')) {
      Taro.cloud.getTempFileURL({
        fileList: [editData.coverImg]
      }).then(res => {
        if (res.fileList[0]?.tempFileURL) {
          setPreviewUrl(res.fileList[0].tempFileURL)
        }
      }).catch(err => {
        console.error('获取临时链接失败', err)
        setPreviewUrl(editData.coverImg) // 失败时回退使用原始 ID
      })
    } else if (editData.coverImg) {
      setPreviewUrl(editData.coverImg) // 如果已经是 https:// 链接，直接使用
    } else {
      setPreviewUrl('')
    }
  }, [editData.coverImg])

  if (!visible) return null

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

      onUpdate({ ...editData, coverImg: uploadRes.fileID })
      Taro.showToast({ title: '图片已上传' })
    } catch (e) {
      console.error('上传失败', e)
    } finally {
      Taro.hideLoading()
    }
  }

  return (
    <View className='edit-sheet-root' onClick={() => !saving && onClose()}>
      <View className='sheet-content' onClick={e => e.stopPropagation()}>
        <View className='sheet-header'>
          <Text className='title'>{isEdit ? '编辑礼品' : '新增礼品'}</Text>
          <View className='close' onClick={() => !saving && onClose()}>×</View>
        </View>

        <ScrollView scrollY className='sheet-body'>
          <View className='form-group'>
            <View className='image-upload-box' onClick={handleUploadImg}>
              {previewUrl ? (
                <Image src={previewUrl} mode='aspectFill' className='preview' />
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
                  onChange={(e) => onUpdate({ ...editData, name: e.detail.value })}
                />
              </View>
              <View className='input-item'>
                <Text className='label'>所需积分</Text>
                <Input
                  className='input'
                  type='number'
                  value={editData.points}
                  onChange={(e) => onUpdate({ ...editData, points: e.detail.value })}
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
              onChange={(e) => onUpdate({ ...editData, desc: e.detail.value })}
            />
          </View>
        </ScrollView>

        <View className='sheet-footer'>
          <Button
            className='save-btn'
            loading={saving}
            onClick={onSave}
          >
            {isEdit ? '保存修改' : '确认添加'}
          </Button>
        </View>
      </View>
    </View>
  )
}

export default GiftEditSheet
