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

const ITEM_ICON_MAP: Array<[string, string]> = [
	['电影', 'tabler:movie'],
	['家务', 'tabler:vacuum-cleaner'],
	['盒', 'tabler:gift'],
	['奶茶', 'tabler:cup'],
	['金牌', 'tabler:medal'],
]

const getItemIcon = (name: string): string => {
	const match = ITEM_ICON_MAP.find(([keyword]) => name.includes(keyword))
	return match ? match[1] : 'tabler:box'
}

const InventoryItemCard: React.FC<InventoryItemCardProps> = React.memo(({ item, currentTab, onUse }) => {

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
