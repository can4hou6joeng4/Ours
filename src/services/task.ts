import { callCloud } from './cloud'
import type {
	AddTaskResponse,
	UpdateTaskStatusResponse,
	CloudFunctionResponse,
	GetRecordsResponse,
} from '../types'

/** 发布任务 */
export async function addTask(data: {
	title: string
	points: number
	type: 'reward' | 'penalty'
	requestId?: string
}): Promise<AddTaskResponse> {
	return callCloud<AddTaskResponse>('addTask', data)
}

/** 更新任务状态（提交/验收） */
export async function updateTaskStatus(data: {
	taskId: string
	action: 'submit' | 'confirm'
}): Promise<UpdateTaskStatusResponse> {
	return callCloud<UpdateTaskStatusResponse>('updateTaskStatus', data)
}

/** 撤销任务 */
export async function revokeTask(data: {
	taskId: string
}): Promise<CloudFunctionResponse> {
	return callCloud<CloudFunctionResponse>('revokeTask', data)
}

/** 获取积分记录 */
export async function getRecords(data: {
	page?: number
	pageSize?: number
	summaryOnly?: boolean
}): Promise<GetRecordsResponse> {
	return callCloud<GetRecordsResponse>('getRecords', data)
}
