const cloud = require('wx-server-sdk')
const {
	normalizeString,
	parsePositiveInteger,
	normalizeOptionalRequestId
} = require('../shared/validation')
const { assertGiftAccessible } = require('../shared/authz')
const { runWithIdempotencyTransaction } = require('../shared/idempotency')
const { changeUserPoints } = require('../shared/points')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

function fail(message) {
	return { success: false, error: message, message }
}

exports.main = async (event, context) => {
	const { OPENID } = cloud.getWXContext()
	const normalizedGiftId = normalizeString(event && (event.giftId || (event.item && event.item.giftId)))
	let requestId = ''

	try {
		if (!normalizedGiftId) {
			throw new Error('缺少礼品ID')
		}
		requestId = normalizeOptionalRequestId(event && event.requestId)
	} catch (validationError) {
		return fail(validationError.message)
	}

	try {
		const result = await runWithIdempotencyTransaction({
			db,
			openid: OPENID,
			scope: 'buyItem',
			requestId,
			work: async transaction => {
				const giftRes = await transaction.collection('Gifts').doc(normalizedGiftId).get().catch(() => null)
				const gift = giftRes && giftRes.data ? giftRes.data : null

				assertGiftAccessible(gift, OPENID)

				const itemName = normalizeString(gift.name)
				const itemPoints = parsePositiveInteger(gift.points, {
					invalidMessage: '礼品信息异常'
				})
				const itemImage = normalizeString(gift.coverImg)

				if (!itemName) {
					throw new Error('礼品信息异常')
				}

				const pointsMutation = await changeUserPoints({
					transaction,
					userId: OPENID,
					delta: -itemPoints,
					insufficientMessage: '积分不足'
				})

				const itemRes = await transaction.collection('Items').add({
					data: {
						userId: OPENID,
						sourceGiftId: normalizedGiftId,
						name: itemName,
						image: itemImage,
						type: 'gift',
						status: 'unused',
						createTime: db.serverDate()
					}
				})

				await transaction.collection('Records').add({
					data: {
						itemId: itemRes._id,
						giftId: normalizedGiftId,
						userId: OPENID,
						type: 'outcome',
						amount: itemPoints,
						balanceAfter: pointsMutation.balanceAfter,
						reason: `兑换: ${itemName}`,
						createTime: db.serverDate()
					}
				})

				const response = {
					success: true,
					itemId: itemRes._id,
					cost: itemPoints,
					balanceAfter: pointsMutation.balanceAfter
				}
				if (requestId) {
					response.requestId = requestId
				}
				return response
			}
		})

		const { __idempotencyReplay, ...finalResult } = result || {}
		return finalResult
	} catch (e) {
		return fail(e.message)
	}
}
