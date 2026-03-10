const cloud = require('wx-server-sdk')
const { normalizeString } = require('../shared/validation')
const { resolveAccessibleUserId } = require('../shared/authz')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async event => {
	const { OPENID } = cloud.getWXContext()
	const { page = 1, pageSize = 50 } = event || {}
	const targetUserInput = normalizeString(event && (event.userId || event.targetUserId))

	try {
		let targetUserId = OPENID
		if (targetUserInput && targetUserInput !== OPENID) {
			const userRes = await db.collection('Users').doc(OPENID).get().catch(() => null)
			const currentUser = userRes && userRes.data ? userRes.data : null
			targetUserId = resolveAccessibleUserId(currentUser, OPENID, targetUserInput)
		}

		const skip = (page - 1) * pageSize
		const recordsRes = await db.collection('Records')
			.where({
				userId: targetUserId
			})
			.orderBy('createTime', 'desc')
			.skip(skip)
			.limit(pageSize)
			.get()

		return {
			success: true,
			data: recordsRes.data
		}
	} catch (e) {
		console.error('获取记录失败', e)
		return {
			success: false,
			message: '操作失败，请重试'
		}
	}
}
