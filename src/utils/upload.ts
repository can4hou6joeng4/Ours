import Taro from '@tarojs/taro'

/**
 * 生成云存储文件路径
 * @param prefix 路径前缀，如 'avatars' 或 'gifts'
 * @param suffix 文件后缀，如 '.png'
 */
export function generateCloudPath(prefix: string, suffix = '.png'): string {
	const timestamp = Date.now()
	const random = Math.random().toString(36).slice(-6)
	return `${prefix}/${timestamp}-${random}${suffix}`
}

/**
 * 通用图片上传（选择 + 压缩 + 上传至云存储）
 * @param prefix 云存储路径前缀
 * @param options 可选配置
 * @returns 上传后的 fileID，取消或失败返回 null
 */
export async function uploadImage(
	prefix: string,
	options: { quality?: number; loadingText?: string } = {}
): Promise<string | null> {
	const { quality = 80, loadingText = '处理图片...' } = options

	try {
		const res = await Taro.chooseMedia({
			count: 1,
			mediaType: ['image'],
			sizeType: ['compressed'],
			sourceType: ['album', 'camera'],
		})
		let tempFilePath = res.tempFiles[0].tempFilePath

		Taro.showLoading({ title: loadingText })

		const compressRes = await Taro.compressImage({
			src: tempFilePath,
			quality,
		})
		tempFilePath = compressRes.tempFilePath

		const suffix = /\.[^.]+$/.exec(tempFilePath)?.[0] || '.png'
		const cloudPath = generateCloudPath(prefix, suffix)

		const uploadRes = await Taro.cloud.uploadFile({
			cloudPath,
			filePath: tempFilePath,
		})

		Taro.showToast({ title: '图片已上传' })
		return uploadRes.fileID
	} catch (e) {
		console.error('上传失败', e)
		return null
	} finally {
		Taro.hideLoading()
	}
}
