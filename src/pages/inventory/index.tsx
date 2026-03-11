import { View, Text, ScrollView, Image, Input } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useMemo, useRef } from 'react'
import { Dialog, Button, Notify } from '@taroify/core'
import dayjs from 'dayjs'
import InventoryItemCard from '../../components/InventoryItemCard'
import ExchangeHistoryModal from '../../components/ExchangeHistoryModal'
import BindingSheet from '../../components/BindingSheet'
import SkeletonCard from '../../components/SkeletonCard'
import EmptyState from '../../components/EmptyState'
import { getIconifyUrl } from '../../utils/assets'
import { requestSubscribe } from '../../utils/subscribe'
import { smartFetchUser } from '../../utils/userCache'
import './index.scss'

// 数据缓存有效期（毫秒）
const DATA_CACHE_DURATION = 30 * 1000 // 30秒
const EXCHANGE_HISTORY_PAGE_SIZE = 20
const PARTNER_GIFT_PAGE_SIZE = 20
const GIFT_PLACEHOLDER_ICON = getIconifyUrl('tabler:gift', '#D4B185')
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

interface GiftUsageRecord {
	_id: string
	name: string
	coverImg?: string
	desc?: string
	points: number
	useTime?: string | Date
	createTime?: string | Date
}

interface StackedGroup {
	stackKey: string
	name: string
	coverImg?: string
	points: number
	records: GiftUsageRecord[]
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
	const [showPartnerGiftSheet, setShowPartnerGiftSheet] = useState(false)
	const [partnerGiftRecords, setPartnerGiftRecords] = useState<GiftUsageRecord[]>([])
	const [partnerGiftGroups, setPartnerGiftGroups] = useState<StackedGroup[]>([])
	const [partnerGiftLoading, setPartnerGiftLoading] = useState(false)
	const [partnerGiftInitialLoading, setPartnerGiftInitialLoading] = useState(false)
	const [partnerGiftPage, setPartnerGiftPage] = useState(1)
	const [partnerGiftHasMore, setPartnerGiftHasMore] = useState(false)
	const [selectedPartnerGiftGroup, setSelectedPartnerGiftGroup] = useState<StackedGroup | null>(null)

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

	const buildPartnerGiftGroups = (list: GiftUsageRecord[]): StackedGroup[] => {
		return list.reduce((acc: StackedGroup[], record) => {
			const stackKey = `${record.name}::${record.coverImg || ''}`
			const existing = acc.find(g => g.stackKey === stackKey)
			if (existing) {
				existing.records.push(record)
				if (record.points > existing.points) existing.points = record.points
			} else {
				acc.push({
					stackKey,
					name: record.name,
					coverImg: record.coverImg,
					points: record.points,
					records: [record]
				})
			}
			return acc
		}, [])
	}

	const formatPartnerGiftPoints = (points: number) =>
		points > 0 ? `🪙 ${points} 积分` : '🪙 积分未知'

	const formatPartnerGiftTime = (t?: string | Date) =>
		t ? dayjs(t).format('YYYY.MM.DD HH:mm') : '—'

	const loadPartnerGiftRecords = async ({ reset = false }: { reset?: boolean } = {}) => {
		if (partnerGiftLoading) return
		if (!partnerGiftHasMore && !reset && partnerGiftRecords.length > 0) return

		const partnerId = Taro.getStorageSync('partnerId') || ''
		if (!partnerId) {
			setPartnerGiftRecords([])
			setPartnerGiftGroups([])
			setPartnerGiftPage(1)
			setPartnerGiftHasMore(false)
			setPartnerGiftInitialLoading(false)
			setPartnerGiftLoading(false)
			return
		}

		setPartnerGiftLoading(true)
		if (reset) setPartnerGiftInitialLoading(true)

		try {
			const requestPage = reset ? 1 : partnerGiftPage
			const { result }: any = await Taro.cloud.callFunction({
				name: 'getGiftUsageRecords',
				data: {
					targetUserId: partnerId,
					page: requestPage,
					pageSize: PARTNER_GIFT_PAGE_SIZE
				}
			})

			if (!result?.success) {
				throw new Error(result?.message || '加载失败')
			}

			const nextRecords = Array.isArray(result.data) ? result.data : []
			const mergedRecords = reset ? nextRecords : [...partnerGiftRecords, ...nextRecords]
			setPartnerGiftRecords(mergedRecords)
			setPartnerGiftGroups(buildPartnerGiftGroups(mergedRecords))
			setPartnerGiftPage(requestPage + 1)
			setPartnerGiftHasMore(nextRecords.length >= PARTNER_GIFT_PAGE_SIZE)
		} catch (error) {
			console.error('获取伴侣礼品使用记录失败', error)
			Taro.showToast({ title: '加载失败，请稍后重试', icon: 'none' })
		} finally {
			setPartnerGiftLoading(false)
			setPartnerGiftInitialLoading(false)
		}
	}

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
				data: { page: requestPage, pageSize: EXCHANGE_HISTORY_PAGE_SIZE, filter, targetUserId: Taro.getStorageSync('partnerId') || '' }
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

	const handleShowPartnerGiftSheet = () => {
		if (!hasPartner) {
			setShowBindingSheet(true)
			return
		}
		setShowPartnerGiftSheet(true)
		loadPartnerGiftRecords({ reset: true })
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
			Notify.open({ type: 'danger', message: '获取背包失败' })
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
				Notify.open({ type: 'danger', message: result.error || '操作失败' })
			}
		} catch (e) {
			Notify.open({ type: 'danger', message: '网络错误' })
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

			{/* TA 的兑换历史入口按钮 */}
			<View className='exchange-history-entry'>
				<View
					className='history-btn'
					onClick={handleShowExchangeHistory}
				>
					<Image src={getIconifyUrl('tabler:history', '#D4B185')} className='history-icon' />
					<Text className='history-text'>TA 的兑换历史</Text>
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
					) : loading ? (
						<View className='inventory-skeleton-list'>
							{[1, 2, 3].map(item => (
								<SkeletonCard
									key={item}
									loading
									row={2}
									rowWidth={['80%', '60%']}
									className='inventory-skeleton-item'
								>
									<View className='inventory-skeleton-card' />
								</SkeletonCard>
							))}
						</View>
					) : filteredItems.length === 0 ? (
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

			{/* TA 的礼品底部弹窗 */}
			{showPartnerGiftSheet && (
				<View
					className='partner-gift-sheet-root'
					onClick={() => {
						setShowPartnerGiftSheet(false)
						setSelectedPartnerGiftGroup(null)
					}}
				>
					<View className='partner-gift-sheet-content' onClick={e => e.stopPropagation()}>
						<View className='sheet-header'>
							<Text className='title'>TA 使用过的礼品</Text>
							<View
								className='close'
								onClick={() => {
									setShowPartnerGiftSheet(false)
									setSelectedPartnerGiftGroup(null)
								}}
							>
								×
							</View>
						</View>

						<ScrollView
							scrollY
							className='partner-gift-scroll'
							lowerThreshold={120}
							onScrollToLower={() => loadPartnerGiftRecords()}
						>
							<View className='partner-gift-inner'>
								{partnerGiftInitialLoading ? (
									<View className='partner-gift-list'>
										{Array.from({ length: 3 }).map((_, index) => (
											<SkeletonCard key={`partner-gift-skeleton-${index}`} loading row={3} className='history-skeleton'>
												<View className='gift-card gift-card-skeleton' />
											</SkeletonCard>
										))}
									</View>
								) : partnerGiftGroups.length === 0 ? (
									<View className='empty-history'>
										<Text className='empty-icon'>📦</Text>
										<Text className='empty-text'>TA 还没有使用过礼品</Text>
									</View>
								) : (
									<View className='partner-gift-list'>
										{partnerGiftGroups.map(group => {
											const count = group.records.length

											return (
												<View
													key={group.stackKey}
													className={`gift-group-card ${count > 1 ? 'is-stacked' : ''}`}
													onClick={() => setSelectedPartnerGiftGroup(group)}
												>
													<View className='gift-card-row'>
														<View className='gift-cover-box'>
															{group.coverImg ? (
																<Image src={group.coverImg} mode='aspectFill' className='gift-cover' />
															) : (
																<View className='gift-cover gift-cover-placeholder'>
																	<Image src={GIFT_PLACEHOLDER_ICON} className='gift-placeholder-icon' />
																</View>
															)}
															{count > 1 && (
																<View className='gift-count-badge'>×{count}</View>
															)}
														</View>

														<View className='gift-content'>
															<Text className='gift-name'>{group.name || '未命名礼品'}</Text>
															<Text className='gift-points'>{formatPartnerGiftPoints(group.points)}</Text>
															{count > 1 && (
																<Text className='gift-usage-count'>共使用 {count} 次</Text>
															)}
														</View>
													</View>
												</View>
											)
										})}

										{partnerGiftLoading && partnerGiftHasMore && (
											<View className='history-footer'>
												<Text className='history-footer-text'>加载中...</Text>
											</View>
										)}

										{!partnerGiftHasMore && partnerGiftGroups.length > 0 && (
											<View className='history-footer'>
												<Text className='history-footer-text'>没有更多记录了</Text>
											</View>
										)}
									</View>
								)}
							</View>
						</ScrollView>
					</View>
				</View>
			)}

			{selectedPartnerGiftGroup && (
				<View className='gift-detail-overlay' onClick={() => setSelectedPartnerGiftGroup(null)}>
					<View className='gift-detail-modal' onClick={e => e.stopPropagation()}>
						<View className='gift-detail-header'>
							<View className='gift-detail-cover-box'>
								{selectedPartnerGiftGroup.coverImg ? (
									<Image src={selectedPartnerGiftGroup.coverImg} mode='aspectFill' className='gift-detail-cover' />
								) : (
									<View className='gift-detail-cover gift-detail-cover--placeholder'>
										<Image src={GIFT_PLACEHOLDER_ICON} className='gift-detail-placeholder-icon' />
									</View>
								)}
							</View>
							<Text className='gift-detail-name'>{selectedPartnerGiftGroup.name}</Text>
							<Text className='gift-detail-points'>{formatPartnerGiftPoints(selectedPartnerGiftGroup.points)}</Text>
						</View>
						<View className='gift-detail-records'>
							{selectedPartnerGiftGroup.records.map((rec, idx) => (
								<View key={rec._id} className='gift-detail-record-row'>
									<Text className='gift-detail-record-index'>第 {idx + 1} 次</Text>
									<Text className='gift-detail-record-time'>{formatPartnerGiftTime(rec.useTime || rec.createTime)}</Text>
								</View>
							))}
						</View>
						<View className='gift-detail-actions'>
							<View className='gift-detail-btn' onClick={() => setSelectedPartnerGiftGroup(null)}>
								<Text>关闭</Text>
							</View>
						</View>
					</View>
				</View>
			)}

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
