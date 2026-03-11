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
	const [selectedGroup, setSelectedGroup] = useState<StackedGroup | null>(null)

	const fetchRecords = async (nextPage = 1, reset = false) => {
		const cachedPartnerId = Taro.getStorageSync('partnerId') || ''
		setPartnerId(cachedPartnerId)

		if (!cachedPartnerId) {
			setRecords([])
			setPage(1)
			setHasMore(false)
			setInitialLoading(false)
			setLoading(false)
			setSelectedGroup(null)
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

	const stackedGroups = useMemo<StackedGroup[]>(() => {
		return records.reduce((acc: StackedGroup[], record) => {
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
	}, [records])

	const handleLoadMore = () => {
		if (!partnerId || loading || !hasMore) return
		fetchRecords(page + 1)
	}

	const formatPoints = (points: number) =>
		points > 0 ? `🪙 ${points} 积分` : '🪙 — 积分'

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
								const count = group.records.length

								return (
									<View
										key={group.stackKey}
										className={`gift-group-card ${count > 1 ? 'is-stacked' : ''}`}
										onClick={() => setSelectedGroup(group)}
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
												<Text className='gift-points'>{formatPoints(group.points)}</Text>
												{count > 1 && (
													<Text className='gift-usage-count'>共使用 {count} 次</Text>
												)}
											</View>
										</View>
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

			{selectedGroup && (
				<View className='history-sheet-root' onClick={() => setSelectedGroup(null)}>
					<View className='history-sheet-content' onClick={e => e.stopPropagation()}>
						<View className='sheet-header'>
							<View className='sheet-title-wrap'>
								<Text className='title'>{selectedGroup.name || '未命名礼品'}</Text>
								<Text className='subtitle'>{formatPoints(selectedGroup.points)}</Text>
							</View>
							<View className='close' onClick={() => setSelectedGroup(null)}>×</View>
						</View>

						<ScrollView scrollY className='sheet-scroll'>
							{selectedGroup.records.length === 0 ? (
								<View className='empty-history'>
									<Text className='empty-icon'>📦</Text>
									<Text className='empty-text'>暂无使用记录</Text>
								</View>
							) : (
								<View className='sheet-record-list'>
									{selectedGroup.records.map((rec, idx) => (
										<View key={rec._id} className='sheet-record-item'>
											<Text className='sheet-record-label'>第 {idx + 1} 次</Text>
											<Text className='sheet-record-time'>
												{formatTime(rec.useTime || rec.createTime)}
											</Text>
										</View>
									))}
								</View>
							)}
						</ScrollView>
					</View>
				</View>
			)}
		</View>
	)
}
