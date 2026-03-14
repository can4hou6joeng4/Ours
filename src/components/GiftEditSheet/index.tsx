import { View, Text, ScrollView, Image } from '@tarojs/components'
import { Button, Input } from '@taroify/core'
import Taro from '@tarojs/taro'
import React from 'react'
import { getIconifyUrl } from '../../utils/assets'
import { uploadImage } from '../../utils/upload'
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
	onSave: () => Promise<boolean> | boolean
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
	const [isSubmitting, setIsSubmitting] = React.useState(false)

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

	React.useEffect(() => {
		if (!saving) {
			setIsSubmitting(false)
		}
	}, [saving])

	if (!visible) return null

	const handleUploadImg = async () => {
		const fileID = await uploadImage('gifts', { loadingText: '处理图片...' })
		if (fileID) {
			onUpdate({ ...editData, coverImg: fileID })
		}
	}

	const handleSubmit = async () => {
		if (saving || isSubmitting) return
		setIsSubmitting(true)
		const result = await onSave()
		if (result === false) {
			setIsSubmitting(false)
		}
	}

	return (
		<View className='edit-sheet-root' onClick={() => !(saving || isSubmitting) && onClose()}>
			<View className='sheet-content' onClick={e => e.stopPropagation()}>
				<View className='sheet-header'>
					<Text className='title'>{isEdit ? '编辑礼品' : '新增礼品'}</Text>
					<View className='close' onClick={() => !(saving || isSubmitting) && onClose()}>×</View>
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
						loading={saving || isSubmitting}
						disabled={saving || isSubmitting}
						onClick={handleSubmit}
					>
						{isEdit ? '保存修改' : '确认添加'}
					</Button>
				</View>
			</View>
		</View>
	)
}

export default GiftEditSheet
