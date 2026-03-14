import { callCloud } from './cloud'
import type { InitUserResponse } from '../types'

/** 初始化/获取用户信息 */
export async function initUser(): Promise<InitUserResponse> {
	return callCloud<InitUserResponse>('initUser')
}

/** 更新用户资料 */
export async function updateUserProfile(data: {
	nickName: string
	avatarUrl?: string
}): Promise<InitUserResponse> {
	return callCloud<InitUserResponse>('updateUserProfile', data)
}

/** 同步绑定邀请码 */
export async function syncBinding(data: {
	inviteCode: string
}): Promise<InitUserResponse> {
	return callCloud<InitUserResponse>('syncBinding', data)
}
