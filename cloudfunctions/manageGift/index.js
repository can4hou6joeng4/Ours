const cloud = require('wx-server-sdk')
const {
	normalizeString,
	normalizeLimitedString,
	parsePositiveInteger,
	normalizeOptionalRequestId
} = require('../shared/validation')
const { runWithIdempotencyTransaction } = require('../shared/idempotency')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

function normalizeGiftData(giftData = {}) {
	const normalizedName = normalizeLimitedString(giftData.name, {
		fieldName: '礼品名称',
		maxLength: 40
	})
	const normalizedDesc = normalizeLimitedString(giftData.desc, {
		fieldName: '礼品描述',
		maxLength: 200,
		allowEmpty: true
	})
	const normalizedPoints = parsePositiveInteger(giftData.points, {
		invalidMessage: '积分必须是正整数'
	})

	return {
		name: normalizedName,
		points: normalizedPoints,
		coverImg: normalizeString(giftData.coverImg),
		desc: normalizedDesc
	}
}

function canManageGift(gift, openid) {
	if (!gift) return false
	return gift.creatorId === openid || gift.partnerId === openid
}

function buildGiftNameForRecord(gift, fallbackName) {
	const fromGift = normalizeString(gift && gift.name)
	const base = fromGift || fallbackName || ''
	if (!base) return '礼品'
	return base.length > 40 ? base.substring(0, 40) : base
}

async function handleAddGift({ transaction, giftData, openid }) {
	const userRes = await transaction.collection('Users').doc(openid).get().catch(() => ({ data: {} }))
	const user = userRes.data || {}
	const partnerId = normalizeString(user.partnerId)

	const res = await transaction.collection('Gifts').add({
		data: {
			...giftData,
			creatorId: openid,
			partnerId: partnerId || null,
			createTime: db.serverDate(),
			updateTime: db.serverDate()
		}
	})

	if (partnerId) {
		await transaction.collection('Notices').add({
			data: {
				type: 'NEW_GIFT',
				title: '🎁 商店上新啦',
				message: `新增了礼品：${giftData.name}`,
				points: giftData.points,
				senderId: openid,
				receiverId: partnerId,
				read: false,
				createTime: db.serverDate()
			}
		})
	}

	return { success: true, id: res._id }
}

async function handleUpdateGift({ transaction, giftId, giftData, openid }) {
	const giftRes = await transaction.collection('Gifts').doc(giftId).get().catch(() => null)
	const gift = giftRes && giftRes.data ? giftRes.data : null
	if (!gift) {
		return { success: false, message: '礼品不存在' }
	}
	if (!canManageGift(gift, openid)) {
		return { success: false, message: '无权修改此礼品' }
	}

	await transaction.collection('Gifts').doc(giftId).update({
		data: {
			...giftData,
			updateTime: db.serverDate()
		}
	})
	return { success: true }
}

async function handleDeleteGift({ transaction, giftId, openid }) {
	const giftRes = await transaction.collection('Gifts').doc(giftId).get().catch(() => null)
	const gift = giftRes && giftRes.data ? giftRes.data : null
	if (!gift) {
		return { success: false, message: '礼品不存在' }
	}
	if (!canManageGift(gift, openid)) {
		return { success: false, message: '无权删除此礼品' }
	}

	await transaction.collection('Gifts').doc(giftId).remove()
	return { success: true }
}

async function handleUseGift({ transaction, giftId, giftNameInput, openid }) {
	const giftRes = await transaction.collection('Gifts').doc(giftId).get().catch(() => null)
	const gift = giftRes && giftRes.data ? giftRes.data : null
	if (!gift) {
		return { success: false, message: '礼品不存在' }
	}
	if (!canManageGift(gift, openid)) {
		return { success: false, message: '无权操作此礼品' }
	}

	await transaction.collection('Gifts').doc(giftId).update({
		data: {
			status: 'used',
			useTime: db.serverDate()
		}
	})

	const giftName = buildGiftNameForRecord(gift, giftNameInput)
	await transaction.collection('Records').add({
		data: {
			userId: openid,
			amount: 0,
			reason: `[使用礼品] ${giftName}`,
			type: 'gift_use',
			giftId,
			createTime: db.serverDate()
		}
	})

	return { success: true }
}

exports.main = async event => {
	const { OPENID } = cloud.getWXContext()
	const action = normalizeString(event && event.action)
	let requestId = ''
	let normalizedGiftData = null
	let normalizedGiftId = ''
	let normalizedUseGiftName = ''

	try {
		requestId = normalizeOptionalRequestId(event && event.requestId)
		if (action === 'add' || action === 'update') {
			normalizedGiftData = normalizeGiftData(event && event.giftData)
		}
		if (action === 'update' || action === 'delete' || action === 'use') {
			normalizedGiftId = normalizeString(event && event.giftId)
			if (!normalizedGiftId) {
				return { success: false, message: 'giftId 缺失' }
			}
		}
		if (action === 'use') {
			normalizedUseGiftName = normalizeLimitedString(event && event.giftName, {
				fieldName: '礼品名称',
				maxLength: 40,
				allowEmpty: true
			})
		}
	} catch (validationError) {
		return { success: false, message: validationError.message }
	}

	const allowedActions = ['add', 'update', 'delete', 'use']
	if (!allowedActions.includes(action)) {
		return { success: false, message: '未知操作' }
	}

	try {
		const result = await runWithIdempotencyTransaction({
			db,
			openid: OPENID,
			scope: `manageGift_${action}`,
			requestId,
			work: async transaction => {
				if (action === 'add') {
					return handleAddGift({ transaction, giftData: normalizedGiftData, openid: OPENID })
				}
				if (action === 'update') {
					return handleUpdateGift({
						transaction,
						giftId: normalizedGiftId,
						giftData: normalizedGiftData,
						openid: OPENID
					})
				}
				if (action === 'delete') {
					return handleDeleteGift({ transaction, giftId: normalizedGiftId, openid: OPENID })
				}
				if (action === 'use') {
					return handleUseGift({
						transaction,
						giftId: normalizedGiftId,
						giftNameInput: normalizedUseGiftName,
						openid: OPENID
					})
				}
				return { success: false, message: '未知操作' }
			}
		})

		const { __idempotencyReplay, ...finalResult } = result || {}
		return finalResult
	} catch (e) {
		console.error('礼品管理失败', e)
		return { success: false, message: '操作失败，请重试' }
	}
}
