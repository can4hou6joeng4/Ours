const cloud = require('wx-server-sdk')
const {
	normalizeString,
	normalizeLimitedString,
	normalizeOptionalRequestId
} = require('../shared/validation')
const { runWithIdempotencyTransaction } = require('../shared/idempotency')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async event => {
	const { OPENID } = cloud.getWXContext()
	const updateData = {}
	let requestId = ''

	try {
		const normalizedAvatar = normalizeString(event && event.avatarUrl)
		const normalizedNickName = normalizeLimitedString(event && event.nickName, {
			fieldName: '昵称',
			maxLength: 20,
			allowEmpty: true
		})
		requestId = normalizeOptionalRequestId(event && event.requestId)

		if (normalizedAvatar) {
			updateData.avatarUrl = normalizedAvatar
		}
		if (normalizedNickName) {
			updateData.nickName = normalizedNickName
		}
		if (Object.keys(updateData).length === 0) {
			return { success: false, message: '无更新内容' }
		}
	} catch (validationError) {
		return { success: false, message: validationError.message }
	}

	try {
		const result = await runWithIdempotencyTransaction({
			db,
			openid: OPENID,
			scope: 'updateUserProfile',
			requestId,
			work: async transaction => {
				await transaction.collection('Users').doc(OPENID).update({
					data: updateData
				})
				return { success: true }
			}
		})

		const { __idempotencyReplay, ...finalResult } = result || {}
		return finalResult
	} catch (e) {
		console.error('更新用户资料失败', e)
		return { success: false, message: '操作失败，请重试' }
	}
}
