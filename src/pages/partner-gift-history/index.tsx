import { useState, useMemo } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import dayjs from 'dayjs'
import EmptyState from '../../components/EmptyState'
import SkeletonCard from '../../components/SkeletonCard'
import { getIconifyUrl } from '../../utils/assets'
import './index.scss'

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

const PAGE_SIZE = 20
const GIFT_PLACEHOLDER_ICON = getIconifyUrl('tabler:gift', '#D4B185')

export default function PartnerGiftHistory() {
	const [partnerId, setPartnerId] = useState('')
	const [records, setRecords] = useState<GiftUsageRecord[]>([])
	const [page, setPage] = useState(1)
	const [loading, setLoading] = useState(false)
	const [initialLoading, setInitialLoading] = useState(true)
	const [hasMore, setHasMore] = useState(false)
	const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set())

	const fetchRecords = async (nextPage = 1, reset = false) => {
		const cachedPartnerId = Taro.getStorageSync('partnerId') || ''
		setPartnerId(cachedPartnerId)

		if (!cachedPartnerId) {
			setRecords([])
			setPage(1)
			setHasMore(false)
			setInitialLoading(false)
			setLoading(false)
			return
		}

		if (loading) return

		setLoading(true)
		if (reset) setInitialLoading(true)

		try {
			const { result }: any = await Taro.cloud.callFunction({
				name: 'getGiftUsageRecords',
				data: {
					targetUserId: cachedPartnerId,
					page: nextPage,
					pageSize: PAGE_SIZE
				}
			})

			if (!result?.success) throw new Error(result?.message || '加载失败')

			const nextRecords = Array.isArray(result.data) ? result.data : []
			setRecords(prev => reset ? nextRecords : [...prev, ...nextRecords])
			setPage(nextPage)
			setHasMore(nextRecords.length >= PAGE_SIZE)
		} catch (error) {
			console.error('获取伴侣礼品使用记录失败', error)
			Taro.showToast({ title: '加载失败，请稍后重试', icon: 'none' })
		} finally {
			setLoading(false)
			setInitialLoading(false)
		}
	}

	useDidShow(() => {
		fetchRecords(1, true)
	})

	// 堆叠逻辑：按 name 聚合
	const stackedGroups = useMemo<StackedGroup[]>(() => {
		return records.reduce((acc: StackedGroup[], record) => {
			const stackKey = `${record.name}::${record.coverImg || ''}`
			const existing = acc.find(g => g.stackKey === stackKey)
			if (existing) {
				existing.records.push(record)
				// 取最大积分（非0优先）
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
	}, [records])

	const toggleExpand = (stackKey: string, count: number) => {
		if (count <= 1) return
		setExpandedKeys(prev => {
			const next = new Set(prev)
			if (next.has(stackKey)) {
				next.delete(stackKey)
			} else {
				next.add(stackKey)
			}
			return next
		})
	}

	const handleLoadMore = () => {
		if (!partnerId || loading || !hasMore) return
		fetchRecords(page + 1)
	}

	const formatPoints = (points: number) =>
		points > 0 ? `🪙 ${points} 积分` : `🪙 — 积分`

	const formatTime = (t?: string | Date) =>
		t ? dayjs(t).format('YYYY.MM.DD HH:mm') : '—'

	const renderSkeletonList = () => (
		<View className='history-list'>
			{Array.from({ length: 3 }).map((_, index) => (
				<SkeletonCard key={`skeleton-${index}`} loading row={3} className='history-skeleton'>
					<View className='gift-card gift-card-skeleton' />
				</SkeletonCard>
			))}
		</View>
	)

	return (
		<View className='partner-gift-history-page'>
			<ScrollView
				scrollY
				className='history-scroll'
				lowerThreshold={120}
				onScrollToLower={handleLoadMore}
			>
				<View className='history-inner'>
					{!partnerId && !initialLoading ? (
						<EmptyState
							icon='tabler:heart-off'
							title='请先绑定另一半'
							desc='绑定后即可查看 TA 的礼品使用记录'
						/>
					) : initialLoading ? (
						renderSkeletonList()
					) : stackedGroups.length === 0 ? (
						<EmptyState
							icon='tabler:heart-off'
							title='TA 还没有使用过礼品'
						/>
					) : (
						<View className='history-list'>
							{stackedGroups.map(group => {
								const isExpanded = expandedKeys.has(group.stackKey)
								const count = group.records.length
								const latestRecord = group.records[0]

								return (
									<View
										key={group.stackKey}
										className='gift-group-card'
										onClick={() => toggleExpand(group.stackKey, count)}
									>
										{/* 数量角标 */}
										{count > 1 && (
											<View className='gift-count-badge'>
												<Text className='gift-count-text'>×{count}</Text>
											</View>
										)}

										{/* 主卡片内容 */}
										<View className='gift-card-row'>
											{group.coverImg ? (
												<Image src={group.coverImg} mode='aspectFill' className='gift-cover' />
											) : (
												<View className='gift-cover gift-cover-placeholder'>
													<Image src={GIFT_PLACEHOLDER_ICON} className='gift-placeholder-icon' />
												</View>
											)}

											<View className='gift-content'>
												<Text className='gift-name'>{group.name || '未命名礼品'}</Text>
												<Text className='gift-points'>{formatPoints(group.points)}</Text>
												{count === 1 && (
													<Text className='gift-time'>
														使用时间：{formatTime(latestRecord.useTime || latestRecord.createTime)}
													</Text>
												)}
												{count > 1 && (
													<Text className='gift-expand-hint'>
														{isExpanded ? '▲ 收起' : `▼ 共使用 ${count} 次`}
													</Text>
												)}
											</View>
										</View>

										{/* 展开子记录 */}
										{count > 1 && (
											<View className={`gift-records-expand ${isExpanded ? 'is-expanded' : ''}`}>
												{group.records.map((rec, idx) => (
													<View key={rec._id} className='gift-record-row'>
														<Text className='gift-record-label'>第 {idx + 1} 次</Text>
														<Text className='gift-record-time'>
															{formatTime(rec.useTime || rec.createTime)}
														</Text>
													</View>
												))}
											</View>
										)}
									</View>
								)
							})}

							{loading && hasMore && (
								<View className='history-footer'>
									<Text className='history-footer-text'>加载中...</Text>
								</View>
							)}

							{!hasMore && stackedGroups.length > 0 && (
								<View className='history-footer'>
									<Text className='history-footer-text'>没有更多记录了</Text>
								</View>
							)}
						</View>
					)}
				</View>
			</ScrollView>
		</View>
	)
}
