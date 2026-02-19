import { View, Text, ScrollView, Image, Input } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useMemo, useRef } from 'react'
import { Dialog, Button } from '@taroify/core'
import InventoryItemCard from '../../components/InventoryItemCard'
import ExchangeHistoryModal from '../../components/ExchangeHistoryModal'
import BindingSheet from '../../components/BindingSheet'
import EmptyState from '../../components/EmptyState'
import { getIconifyUrl } from '../../utils/assets'
import { requestSubscribe } from '../../utils/subscribe'
import { smartFetchUser } from '../../utils/userCache'
import './index.scss'

// 数据缓存有效期（毫秒）
const DATA_CACHE_DURATION = 30 * 1000 // 30秒
const EXCHANGE_HISTORY_PAGE_SIZE = 20
type ItemStatus = 'unused' | 'used'
type HistoryFilter = 'all' | 'unused' | 'used'

interface InventoryItem {
	_id: string
	userId: string
	sourceGiftId?: string
	name: string
	image?: string
	cover?: string
	desc?: string
	status: ItemStatus
	createTime: string | Date
	useTime?: string | Date
	count?: number
	stackedKey?: string
}

export default function Inventory() {
	const [items, setItems] = useState<InventoryItem[]>([])
	const [currentTab, setCurrentTab] = useState<ItemStatus>('unused')
	const [loading, setLoading] = useState(false)
	const [showConfirm, setShowConfirm] = useState(false)
	const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null)
	const [using, setUsing] = useState(false)
	const [searchTerm, setSearchTerm] = useState('')
	const [showExchangeHistory, setShowExchangeHistory] = useState(false)
	const [historyList, setHistoryList] = useState<any[]>([])
	const [historyLoading, setHistoryLoading] = useState(false)
	const [historyPage, setHistoryPage] = useState(1)
	const [hasMoreHistory, setHasMoreHistory] = useState(true)
	const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('all')
	const [hasPartner, setHasPartner] = useState(false)
	const [showBindingSheet, setShowBindingSheet] = useState(false)

	// 性能优化：记录上次数据获取时间
	const lastFetchTime = useRef<number>(0)

	useDidShow(() => {
		// 获取用户绑定状态
		smartFetchUser({
			onCacheHit: (cached) => {
				setHasPartner(!!cached.user?.partnerId)
			},
			onFresh: (result) => {
				if (result?.success) {
					setHasPartner(!!result.user?.partnerId)
				}
			}
		})

		// 性能优化：如果距离上次获取不足缓存时间且有数据，跳过请求
		const now = Date.now()
		if (items.length > 0 && now - lastFetchTime.current < DATA_CACHE_DURATION) {
			return
		}
		fetchItems()
	})

	// 加载兑换历史数据
	const loadExchangeHistory = async ({
		reset = false,
		filter = historyFilter
	}: {
		reset?: boolean
		filter?: HistoryFilter
	} = {}) => {
		if (historyLoading) return
		if (!hasMoreHistory && !reset) return

		setHistoryLoading(true)
		try {
			const requestPage = reset ? 1 : historyPage
			const { result }: any = await Taro.cloud.callFunction({
				name: 'getExchangeHistory',
				data: { page: requestPage, pageSize: EXCHANGE_HISTORY_PAGE_SIZE, filter }
			})

			if (result.success) {
				const nextData = Array.isArray(result.data) ? result.data : []
				setHistoryList(prev => (reset ? nextData : [...prev, ...nextData]))
				setHasMoreHistory(nextData.length >= EXCHANGE_HISTORY_PAGE_SIZE)
				setHistoryPage(requestPage + 1)
			}
		} catch (e) {
			console.error('加载兑换历史失败', e)
		} finally {
			setHistoryLoading(false)
		}
	}

	// 打开兑换历史弹窗
	const handleShowExchangeHistory = () => {
		if (!hasPartner) {
			setShowBindingSheet(true)
			return
		}
		setShowExchangeHistory(true)
		loadExchangeHistory({ reset: true, filter: historyFilter })
	}

	// 切换历史筛选
	const handleHistoryFilterChange = (filter: HistoryFilter) => {
		setHistoryFilter(filter)
		setHistoryPage(1)
		setHasMoreHistory(true)
		loadExchangeHistory({ reset: true, filter })
	}

	const fetchItems = async () => {
		setLoading(true)
		try {
			const { result }: any = await Taro.cloud.callFunction({ name: 'getItems' })
			if (result.success) {
				const nextItems = Array.isArray(result.data) ? result.data : []
				setItems(nextItems)
				lastFetchTime.current = Date.now()
			}
		} catch (e) {
			Taro.showToast({ title: '获取背包失败', icon: 'none' })
		} finally {
			setLoading(false)
		}
	}

	const openUseConfirm = (item: InventoryItem) => {
		setSelectedItem(item)
		setShowConfirm(true)
	}

	const handleConfirmUse = async () => {
		if (!selectedItem || using) return

		setUsing(true)
		try {
			const { result }: any = await Taro.cloud.callFunction({
				name: 'useItem',
				data: { itemId: selectedItem._id }
			})

			if (result.success) {
				Taro.showToast({ title: '兑换申请已发出', icon: 'success' })
				setShowConfirm(false)
				fetchItems()
				// 成功后引导订阅
				requestSubscribe(['GIFT_USED'])
			} else {
				Taro.showToast({ title: result.error || '操作失败', icon: 'none' })
			}
		} catch (e) {
			Taro.showToast({ title: '网络错误', icon: 'none' })
		} finally {
			setUsing(false)
		}
	}

	const filteredItems = useMemo(() => {
		const keyword = searchTerm.trim().toLowerCase()
		return items.filter(item => {
			const isStatusMatch = item.status === currentTab
			if (!isStatusMatch) return false
			if (!keyword) return true

			const name = String(item.name || '').toLowerCase()
			const desc = String(item.desc || '').toLowerCase()
			return name.includes(keyword) || desc.includes(keyword)
		})
	}, [items, currentTab, searchTerm])

	// 礼品堆叠逻辑：优先按 sourceGiftId 聚合，缺失时回退到名称+图片
	const stackedItems = useMemo(() => {
		return filteredItems.reduce((acc: InventoryItem[], item) => {
			const stackKey = `${item.sourceGiftId || ''}::${item.name}::${item.image || item.cover || ''}`
			const existing = acc.find(i => i.stackedKey === stackKey)
			if (existing) {
				existing.count = (existing.count || 1) + 1
			} else {
				acc.push({ ...item, count: 1, stackedKey: stackKey })
			}
			return acc
		}, [])
	}, [filteredItems])

	return (
		<View className='inventory-container'>
			<View className='search-container'>
				<View className='search-bar'>
					<Image src={getIconifyUrl('tabler:search', '#8E8E93')} className='search-icon' />
					<Input
						className='search-input'
						placeholder='搜索礼品名称或描述'
						value={searchTerm}
						onInput={(e) => setSearchTerm(e.detail.value || '')}
					/>
				</View>
			</View>

			{/* 兑换历史入口按钮 */}
			<View className='exchange-history-entry'>
				<View
					className='history-btn'
					onClick={handleShowExchangeHistory}
				>
					<Image src={getIconifyUrl('tabler:history', '#D4B185')} className='history-icon' />
					<Text className='history-text'>兑换历史</Text>
					<Text className='history-arrow'>⟩</Text>
				</View>
			</View>

			<View className='tabs-header'>
				<View className='tabs-capsule'>
					<View
						className={`tab-item ${currentTab === 'unused' ? 'active' : ''}`}
						onClick={() => setCurrentTab('unused')}
					>
						待使用
					</View>
					<View
						className={`tab-item ${currentTab === 'used' ? 'active' : ''}`}
						onClick={() => setCurrentTab('used')}
					>
						已使用
					</View>
				</View>
			</View>

			<ScrollView scrollY className='items-scroll'>
				<View className='items-inner'>
					{!hasPartner ? (
						<EmptyState
							icon='tabler:link'
							title='背包尚未开启'
							desc='绑定另一半后，可以查看和使用兑换的礼品'
							btnText='去绑定'
							onAction={() => setShowBindingSheet(true)}
						/>
					) : filteredItems.length === 0 && !loading ? (
						<View className='empty-state'>
							<Image src={getIconifyUrl('tabler:package-off', '#8E8E93')} className='empty-icon-img' />
							<Text className='empty-text'>{searchTerm ? '没有匹配的礼品' : '背包空空如也'}</Text>
						</View>
					) : (
						<View className='items-grid'>
							{stackedItems.map(item => (
								<InventoryItemCard
									key={item.stackedKey || item._id}
									item={item}
									currentTab={currentTab}
									onUse={openUseConfirm}
								/>
							))}
						</View>
					)}
				</View>
			</ScrollView>

			{/* 使用确认弹窗 */}
			<Dialog open={showConfirm} onClose={() => !using && setShowConfirm(false)}>
				<Dialog.Header>确认使用</Dialog.Header>
				<Dialog.Content>
					确定要向对方发起“{selectedItem?.name}”的使用申请吗？
					对方将立即收到通知。
				</Dialog.Content>
				<Dialog.Actions>
					<Button onClick={() => !using && setShowConfirm(false)}>取消</Button>
					<Button loading={using} onClick={handleConfirmUse}>确认使用</Button>
				</Dialog.Actions>
			</Dialog>

			{/* 兑换历史底部弹窗 */}
			<ExchangeHistoryModal
				visible={showExchangeHistory}
				historyList={historyList}
				loading={historyLoading}
				hasMore={hasMoreHistory}
				filter={historyFilter}
				onClose={() => setShowExchangeHistory(false)}
				onFilterChange={handleHistoryFilterChange}
				onLoadMore={() => loadExchangeHistory()}
			/>

			{/* 绑定弹窗 */}
			<BindingSheet
				visible={showBindingSheet}
				onClose={() => setShowBindingSheet(false)}
				onSuccess={() => {
					setShowBindingSheet(false)
					setHasPartner(true)
					fetchItems()
				}}
			/>
		</View>
	)
}
