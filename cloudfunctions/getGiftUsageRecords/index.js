const cloud = require('wx-server-sdk')
const { normalizeString, parsePositiveInteger } = require('./shared/validation')
const { resolveAccessibleUserId } = require('./shared/authz')

cloud.init({
	env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

function extractGiftName(reason) {
	return String(reason || '')
		.replace(/^\[(使用礼品|兑换请求)\]\s*/, '')
		.trim()
}

function buildGiftIds(records, itemsById) {
	const giftIds = new Set()

	records.forEach(record => {
		const item = record.itemId ? itemsById.get(String(record.itemId)) : null
		const giftId = normalizeString(record.sourceGiftId || record.giftId || item?.sourceGiftId)
		if (giftId) {
			giftIds.add(giftId)
		}
	})

	return Array.from(giftIds)
}

async function getItemsByIds(itemIds) {
	const validIds = Array.from(new Set((Array.isArray(itemIds) ? itemIds : []).filter(Boolean).map(id => String(id))))
	const itemsById = new Map()

	if (validIds.length === 0) {
		return itemsById
	}

	const batchSize = 20
	for (let i = 0; i < validIds.length; i += batchSize) {
		const batch = validIds.slice(i, i + batchSize)
		const res = await db.collection('Items')
			.where({
				_id: _.in(batch)
			})
			.get()

		;(Array.isArray(res.data) ? res.data : []).forEach(item => {
			itemsById.set(String(item._id), item)
		})
	}

	return itemsById
}

async function getGiftsByIds(giftIds) {
	const validIds = Array.from(new Set((Array.isArray(giftIds) ? giftIds : []).filter(Boolean).map(id => String(id))))
	const giftsById = new Map()

	if (validIds.length === 0) {
		return giftsById
	}

	const batchSize = 20
	for (let i = 0; i < validIds.length; i += batchSize) {
		const batch = validIds.slice(i, i + batchSize)
		const res = await db.collection('Gifts')
			.where({
				_id: _.in(batch)
			})
			.get()

		;(Array.isArray(res.data) ? res.data : []).forEach(gift => {
			giftsById.set(String(gift._id), gift)
		})
	}

	return giftsById
}

async function resolveGiftCoverUrls(giftsById) {
	const fileIds = Array.from(new Set(
		Array.from(giftsById.values())
			.map(gift => normalizeString(gift.coverImg))
			.filter(fileId => fileId.startsWith('cloud://'))
	))
	const tempUrlMap = new Map()

	if (fileIds.length === 0) {
		return tempUrlMap
	}

	const res = await cloud.getTempFileURL({
		fileList: fileIds
	})

	;(Array.isArray(res.fileList) ? res.fileList : []).forEach(file => {
		if (file.fileID && file.tempFileURL) {
			tempUrlMap.set(file.fileID, file.tempFileURL)
		}
	})

	return tempUrlMap
}

exports.main = async event => {
	const { OPENID } = cloud.getWXContext()
	const targetUserInput = normalizeString(event && (event.targetUserId || event.userId))
	let page = 1
	let pageSize = 20

	try {
		page = parsePositiveInteger(event && event.page ? event.page : 1, {
			invalidMessage: 'page 必须是正整数'
		})
		pageSize = parsePositiveInteger(event && event.pageSize ? event.pageSize : 20, {
			invalidMessage: 'pageSize 必须是正整数',
			max: 100,
			maxMessage: 'pageSize 不能超过 100'
		})

		const userRes = await db.collection('Users').doc(OPENID).get().catch(() => null)
		const currentUser = userRes && userRes.data ? userRes.data : null
		const targetUserId = resolveAccessibleUserId(currentUser, OPENID, targetUserInput)
		const skip = (page - 1) * pageSize

		const recordsRes = await db.collection('Records')
			.where({
				userId: targetUserId,
				type: 'gift_use'
			})
			.orderBy('createTime', 'desc')
			.skip(skip)
			.limit(pageSize)
			.get()

		const records = Array.isArray(recordsRes.data) ? recordsRes.data : []
		const itemIds = records
			.map(record => normalizeString(record.itemId))
			.filter(Boolean)
		const itemsById = await getItemsByIds(itemIds)
		const giftsById = await getGiftsByIds(buildGiftIds(records, itemsById))
		const tempUrlMap = await resolveGiftCoverUrls(giftsById)

		const data = records.map(record => {
			const item = record.itemId ? itemsById.get(String(record.itemId)) : null
			const giftId = normalizeString(record.sourceGiftId || record.giftId || item?.sourceGiftId)
			const gift = giftId ? giftsById.get(giftId) : null
			const rawCoverImg = normalizeString(gift && gift.coverImg)
			const coverImg = tempUrlMap.get(rawCoverImg) || rawCoverImg

			return {
				_id: record._id,
				name: normalizeString(gift && gift.name) || extractGiftName(record.reason),
				coverImg,
				desc: normalizeString(gift && gift.desc),
				points: Number(gift && gift.points) || 0,
				useTime: item?.useTime || record.createTime,
				createTime: record.createTime
			}
		})

		return {
			success: true,
			data
		}
	} catch (e) {
		console.error('获取礼品使用记录失败', e)
		return {
			success: false,
			message: e.message || '操作失败，请重试'
		}
	}
}
