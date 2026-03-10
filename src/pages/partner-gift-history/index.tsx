import { useState } from 'react'
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

const PAGE_SIZE = 20
const GIFT_PLACEHOLDER_ICON = getIconifyUrl('tabler:gift', '#D4B185')

export default function PartnerGiftHistory() {
	const [partnerId, setPartnerId] = useState('')
	const [records, setRecords] = useState<GiftUsageRecord[]>([])
	const [page, setPage] = useState(1)
	const [loading, setLoading] = useState(false)
	const [initialLoading, setInitialLoading] = useState(true)
	const [hasMore, setHasMore] = useState(false)

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

		if (loading) {
			return
		}

		setLoading(true)
		if (reset) {
			setInitialLoading(true)
		}

		try {
			const { result }: any = await Taro.cloud.callFunction({
				name: 'getGiftUsageRecords',
				data: {
					targetUserId: cachedPartnerId,
					page: nextPage,
					pageSize: PAGE_SIZE
				}
			})

			if (!result?.success) {
				throw new Error(result?.message || '加载失败')
			}

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

	const handleLoadMore = () => {
		if (!partnerId || loading || !hasMore) {
			return
		}

		fetchRecords(page + 1)
	}

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
					) : records.length === 0 ? (
						<EmptyState
							icon='tabler:heart-off'
							title='TA 还没有使用过礼品'
						/>
					) : (
						<View className='history-list'>
							{records.map(item => (
								<View key={item._id} className='gift-card'>
									{item.coverImg ? (
										<Image src={item.coverImg} mode='aspectFill' className='gift-cover' />
									) : (
										<View className='gift-cover gift-cover-placeholder'>
											<Image src={GIFT_PLACEHOLDER_ICON} className='gift-placeholder-icon' />
										</View>
									)}

									<View className='gift-content'>
										<Text className='gift-name'>{item.name || '未命名礼品'}</Text>
										<Text className='gift-points'>{item.points || 0} 积分</Text>
										<Text className='gift-time'>
											使用时间：{dayjs(item.useTime || item.createTime).format('YYYY.MM.DD HH:mm')}
										</Text>
										<Text className='gift-desc'>{item.desc || '暂无描述'}</Text>
									</View>
								</View>
							))}

							{loading && hasMore && (
								<View className='history-footer'>
									<Text className='history-footer-text'>加载中...</Text>
								</View>
							)}

							{!hasMore && records.length > 0 && (
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
