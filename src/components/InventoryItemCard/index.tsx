import { View, Text, Image } from '@tarojs/components'
import React from 'react'
import dayjs from 'dayjs'
import { getIconifyUrl } from '../../utils/assets'
import './index.scss'

type ItemStatus = 'unused' | 'used'

interface InventoryItemData {
	_id: string
	name: string
	image?: string
	cover?: string
	createTime: string | Date
	useTime?: string | Date
	count?: number
}

interface InventoryItemCardProps {
	item: InventoryItemData
	currentTab: ItemStatus
	onUse: (item: InventoryItemData) => void
}

const InventoryItemCard: React.FC<InventoryItemCardProps> = React.memo(({ item, currentTab, onUse }) => {
	// 根据类型获取图标
	const getItemIcon = (name: string) => {
		if (name.includes('电影')) return 'tabler:movie'
		if (name.includes('家务')) return 'tabler:vacuum-cleaner'
		if (name.includes('盒')) return 'tabler:gift'
		if (name.includes('奶茶')) return 'tabler:cup'
		if (name.includes('金牌')) return 'tabler:medal'
		return 'tabler:box'
	}

	const displayTime = currentTab === 'unused'
		? item.createTime
		: (item.useTime || item.createTime)

	return (
		<View className={`item-card-v4 ${currentTab} ${item.count > 1 ? 'is-stacked' : ''}`}>
			<View className='item-icon-box'>
				{item.image || item.cover ? (
					<Image
						src={item.image || item.cover}
						className='inner-icon thumb-img'
						mode='aspectFill'
					/>
				) : (
					<Image
						src={getIconifyUrl(getItemIcon(item.name), currentTab === 'unused' ? '#D4B185' : '#BBB')}
						className='inner-icon'
					/>
				)}
				{item.count > 1 && (
					<View className='item-count-badge'>x{item.count}</View>
				)}
			</View>
			<View className='item-info'>
				<Text className='item-name'>{item.name}</Text>
				<Text className='item-time'>
					{dayjs(displayTime).format('YYYY.MM.DD HH:mm')} {currentTab === 'unused' ? '获得' : '已兑换'}
				</Text>
			</View>
			{currentTab === 'unused' && (
				<View className='use-btn-pill' onClick={() => onUse(item)}>去使用</View>
			)}
		</View>
	)
})

export default InventoryItemCard
