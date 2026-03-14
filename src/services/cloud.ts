import Taro from '@tarojs/taro'
import type { CloudFunctionResponse } from '../types'

/**
 * 通用云函数调用封装
 * 统一错误处理 & 类型安全
 */
export async function callCloud<T extends CloudFunctionResponse>(
	name: string,
	data?: Record<string, unknown>
): Promise<T> {
	try {
		const { result } = await Taro.cloud.callFunction({ name, data }) as { result: T }
		return result
	} catch (e) {
		console.error(`[cloud] ${name} 调用失败`, e)
		return { success: false, message: '网络异常，请稍后重试' } as T
	}
}
