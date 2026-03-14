import { View, Text, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import React, { useState, useCallback, useRef } from 'react'
import type { Notice } from '../../types'
import './index.scss'

interface NoticeModalProps {
	visible: boolean
	notice: Notice | null
	onClose: () => void
	onConfettiRef?: React.RefObject<{ fire: () => void } | null>
}

const NoticeModal: React.FC<NoticeModalProps> = ({ visible, notice, onClose, onConfettiRef }) => {
	const [isClosing, setIsClosing] = useState(false)
	const closingRef = useRef(false)

	const handleClose = useCallback(async () => {
		if (!notice || closingRef.current) return
		closingRef.current = true

		// 触发粒子动效
		onConfettiRef?.current?.fire()

		// 强化触感反馈：双重微震动
		Taro.vibrateShort()
		setTimeout(() => Taro.vibrateShort(), 100)

		// 延迟启动退出动效，让粒子动效先飞一会儿
		setTimeout(() => setIsClosing(true), 200)

		// 延迟执行状态清理 (200ms停顿 + 600ms动画 = 800ms)
		setTimeout(() => {
			onClose()
			setIsClosing(false)
			closingRef.current = false
		}, 800)

		// 异步标记已读（不阻塞 UI）
		try {
			await Taro.cloud.database().collection('Notices').doc(notice._id).update({
				data: { read: true }
			})
		} catch (e) {
			console.error('标记已读失败', e)
		}
	}, [notice, onClose, onConfettiRef])

	if (!visible || !notice) return null

	return (
		<View className='notice-modal-root' onClick={handleClose}>
			<View className={`notice-card ${isClosing ? 'closing' : ''}`} onClick={e => e.stopPropagation()}>
				<View className='card-header'>
					<View className='notice-tag'>{notice.type}</View>
					<View className='close-btn' onClick={handleClose}>x</View>
				</View>

				<View className='card-body'>
					<View className='notice-icon-box'>
						{notice.type === 'NEW_TASK' && <Text className='emoji'>✨</Text>}
						{notice.type === 'TASK_CONFIRM' && <Text className='emoji'>👀</Text>}
						{notice.type === 'TASK_DONE' && <Text className='emoji'>🎉</Text>}
						{notice.type === 'NEW_GIFT' && <Text className='emoji'>🎁</Text>}
						{notice.type === 'GIFT_USED' && <Text className='emoji'>💝</Text>}
					</View>

					<Text className='notice-title'>{notice.title}</Text>
					<View className='notice-message-box'>
						<Text className='notice-message'>{notice.message}</Text>
					</View>

					{notice.points !== 0 && (
						<View className='notice-points'>
							<Text className='label'>积分变动</Text>
							<Text className={`value ${(notice.points || 0) > 0 ? 'plus' : 'minus'}`}>
								{(notice.points || 0) > 0 ? '+' : ''}{notice.points}
							</Text>
						</View>
					)}
				</View>

				<View className='card-footer'>
					<Button className='btn-confirm' onClick={handleClose}>
						我已收到 ⟩
					</Button>
				</View>
			</View>
		</View>
	)
}

export default NoticeModal
