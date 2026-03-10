const cloud = require('wx-server-sdk')
const { normalizeString } = require('../shared/validation')
const { getAllowedUserIds, resolveAccessibleUserId } = require('../shared/authz')

cloud.init({
	env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

function buildNoticeQueryOrConditions(allowedUserIds) {
	const dedupedIds = Array.from(new Set(allowedUserIds))
	const conditions = []
	dedupedIds.forEach(id => {
		conditions.push({ senderId: id })
		conditions.push({ receiverId: id })
	})
	return conditions
}

function filterNoticesByAllowedUsers(records, allowedUserIds, targetUserId) {
	const allowedSet = new Set(allowedUserIds)
	const filtered = records.filter(item => {
		const senderAllowed = allowedSet.has(item.senderId)
		const receiverAllowed = !item.receiverId || allowedSet.has(item.receiverId)
		return senderAllowed && receiverAllowed
	})

	if (!targetUserId) {
		return filtered
	}
	return filtered.filter(item => item.senderId === targetUserId || item.receiverId === targetUserId)
}

exports.main = async event => {
	const { OPENID } = cloud.getWXContext()
	const { page = 1, pageSize = 20 } = event || {}
	const targetUserInput = normalizeString(event && (event.userId || event.targetUserId))

	try {
		const userRes = await db.collection('Users').doc(OPENID).get().catch(() => null)
		const currentUser = userRes && userRes.data ? userRes.data : null
		const allowedUserIds = getAllowedUserIds(currentUser, OPENID)
		const targetUserId = resolveAccessibleUserId(currentUser, OPENID, targetUserInput)

		const noticeOrConditions = buildNoticeQueryOrConditions(allowedUserIds)
		const res = await db.collection('Notices')
			.where({
				type: 'GIFT_USED',
				_or: noticeOrConditions
			})
			.orderBy('createTime', 'desc')
			.skip((page - 1) * pageSize)
			.limit(pageSize)
			.get()

		const filteredRecords = filterNoticesByAllowedUsers(
			Array.isArray(res.data) ? res.data : [],
			allowedUserIds,
			targetUserInput ? targetUserId : ''
		)

		const data = filteredRecords.map(item => {
			const giftName = String(item.message || '').replace('对方想要使用：', '')

			return {
				_id: item._id,
				giftName,
				direction: item.senderId === OPENID ? 'sent' : 'received',
				createTime: item.createTime,
				read: item.read,
				title: item.title
			}
		})

		return {
			success: true,
			data
		}
	} catch (e) {
		console.error('获取礼品记录失败', e)
		return {
			success: false,
			message: '操作失败，请重试'
		}
	}
}
