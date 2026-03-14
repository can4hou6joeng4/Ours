// ============================================================
// 全局类型定义
// ============================================================

// ---- 用户相关 ----

export interface User {
	_id: string
	totalPoints: number
	partnerId: string
	nickName?: string
	avatarUrl?: string
	createTime: string | Date
}

// ---- 任务相关 ----

export type TaskStatus = 'pending' | 'waiting_confirmation' | 'done' | 'revoked'
export type TaskType = 'reward' | 'penalty'

export interface Task {
	_id: string
	title: string
	points: number
	type: TaskType
	status: TaskStatus
	creatorId: string
	targetId: string
	executorId: string
	createTime: string | Date
}

// ---- 礼品 / 商店相关 ----

export interface Gift {
	_id: string
	name: string
	points: number
	coverImg?: string
	desc?: string
	creatorId: string
	partnerId: string
	createTime: string | Date
}

export interface GiftEditData {
	name: string
	points: string
	coverImg: string
	desc: string
}

// ---- 背包物品 ----

export type ItemStatus = 'unused' | 'used'

export interface InventoryItem {
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

// ---- 积分记录 ----

export type RecordType = 'reward' | 'penalty' | 'outcome' | 'gift_use' | 'exchange' | 'gift'

export interface PointRecord {
	_id: string
	userId: string
	amount: number
	points?: number
	balanceAfter?: number
	reason?: string
	title?: string
	type: RecordType
	itemId?: string
	giftId?: string
	createTime: string | Date
	timestamp?: string | Date
}

// ---- 兑换历史 ----

export interface ExchangeHistoryItem {
	_id: string
	name: string
	image: string
	giftId?: string
	points: number
	status: 'unused' | 'used' | 'deleted'
	createTime: string | Date
	isDeleted: boolean

	purchaseRecord: {
		_id: string
		amount: number
		createTime: string | Date
		operator: string
	}

	useRecord?: {
		_id: string
		useTime: string | Date
		operator: string
		receiver: string
		message: string
	}
}

export type HistoryFilter = 'all' | 'unused' | 'used'

// ---- 通知 ----

export type NoticeType = 'NEW_TASK' | 'TASK_DONE' | 'GIFT_USED'

export interface Notice {
	_id: string
	type: NoticeType
	title: string
	message: string
	points?: number
	senderId: string
	receiverId: string
	read: boolean
	createTime: string | Date
}

// ---- 通知弹窗数据 ----

export interface NotifyData {
	title: string
	message: string
	type: TaskType
}

// ---- 云函数响应 ----

export interface CloudFunctionResponse<T = unknown> {
	success: boolean
	message?: string
	error?: string
	data?: T
}

export interface InitUserResponse extends CloudFunctionResponse {
	user?: User
	todayChange?: number
}

export interface AddTaskResponse extends CloudFunctionResponse {
	id?: string
	balanceAfter?: number
	requestId?: string
}

export interface UpdateTaskStatusResponse extends CloudFunctionResponse {
	points?: number
}

export interface BuyItemResponse extends CloudFunctionResponse {
	itemId?: string
	cost?: number
	balanceAfter?: number
	requestId?: string
}

export interface GetGiftsResponse extends CloudFunctionResponse {
	gifts?: Gift[]
}

export interface GetItemsResponse extends CloudFunctionResponse {
	data?: InventoryItem[]
	hasMore?: boolean
}

export interface GetRecordsResponse extends CloudFunctionResponse {
	data?: PointRecord[]
}

export interface GetExchangeHistoryResponse extends CloudFunctionResponse {
	data?: ExchangeHistoryItem[]
	total?: number
	page?: number
	pageSize?: number
}

export interface UseItemResponse extends CloudFunctionResponse {
	requestId?: string
}

export interface ManageGiftResponse extends CloudFunctionResponse {
	giftId?: string
}
