const cloud = require('wx-server-sdk')
const { normalizeString } = require('./shared/validation')
const { getAllowedUserIds, resolveAccessibleUserId } = require('./shared/authz')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

/**
 * 获取兑换历史记录
 * event: { page, pageSize, filter, targetUserId }
 * filter: 'all' | 'unused' | 'used'
 *
 * 性能优化：不再调用 getTempFileURL 换签，
 * 小程序 Image 组件原生支持 cloud:// 文件 ID。
 */
exports.main = async (event, context) => {
	const { OPENID } = cloud.getWXContext()
	const rawPage = Number(event && event.page)
	const rawPageSize = Number(event && event.pageSize)
	const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1
	const pageSize = Number.isFinite(rawPageSize) && rawPageSize > 0 ? Math.min(Math.floor(rawPageSize), 100) : 20
	const filterInput = normalizeString(event && event.filter) || 'all'
	const allowedFilters = ['all', 'unused', 'used']
	if (!allowedFilters.includes(filterInput)) {
		return { success: false, message: '筛选条件不合法' }
	}

	const targetUserInput = normalizeString(event && (event.userId || event.targetUserId))

	try {
		const userRes = await db.collection('Users').doc(OPENID).get().catch(() => null)
		const currentUser = userRes && userRes.data ? userRes.data : null
		const allowedUserIds = getAllowedUserIds(currentUser, OPENID)
		const targetUserId = resolveAccessibleUserId(currentUser, OPENID, targetUserInput)

		const purchaseQuery = buildPurchaseQuery(targetUserId)
		const [purchaseRes, totalRes] = await Promise.all([
			purchaseQuery
				.orderBy('createTime', 'desc')
				.skip((page - 1) * pageSize)
				.limit(pageSize)
				.get(),
			typeof purchaseQuery.count === 'function' ? purchaseQuery.count().catch(() => null) : Promise.resolve(null)
		])

		const purchaseRecords = Array.isArray(purchaseRes.data) ? purchaseRes.data : []
		const total = totalRes && typeof totalRes.total === 'number' ? totalRes.total : null

		if (purchaseRecords.length === 0) {
			return {
				success: true,
				data: [],
				total: total || 0,
				page,
				pageSize
			}
		}

		const relatedContext = buildRelatedContext(purchaseRecords, pageSize)
		const [items, useRecords, notices] = await Promise.all([
			getRelatedItems(targetUserId, relatedContext),
			getRelatedUseRecords(targetUserId, relatedContext),
			getRelatedUseNotices(targetUserId, allowedUserIds, relatedContext)
		])

		const historyList = await integrateData(
			OPENID,
			purchaseRecords,
			items,
			useRecords,
			notices
		)

		const filteredList = filterHistoryList(historyList, filterInput)
		const finalTotal = total !== null ? total : (page - 1) * pageSize + filteredList.length

		return {
			success: true,
			data: filteredList,
			total: finalTotal,
			page,
			pageSize
		}
	} catch (e) {
		console.error('获取兑换历史失败', e)
		return {
			success: false,
			message: '操作失败，请重试'
		}
	}
}

function buildPurchaseQuery(userId) {
	return db.collection('Records').where({
		userId,
		type: 'outcome',
		reason: db.RegExp({ regexp: '^兑换:' })
	})
}

function buildRelatedContext(purchaseRecords, pageSize) {
	const itemIds = [...new Set(purchaseRecords.map(record => normalizeString(record.itemId)).filter(Boolean))]
	const itemNames = [...new Set(purchaseRecords.map(record => extractPurchaseItemName(record.reason)).filter(Boolean))]
	const timestamps = purchaseRecords
		.map(record => toTimestamp(record.createTime))
		.filter(ts => ts > 0)
	const minTs = timestamps.length ? Math.min(...timestamps) : 0
	const maxTs = timestamps.length ? Math.max(...timestamps) : 0
	const rangePadding = 7 * 24 * 60 * 60 * 1000

	return {
		itemIds,
		itemNames,
		startTime: minTs ? new Date(minTs - rangePadding) : null,
		endTime: maxTs ? new Date(maxTs + rangePadding) : null,
		relatedLimit: Math.min(Math.max(pageSize * 3, 20), 60)
	}
}

async function getRelatedItems(userId, context) {
	const where = { userId }
	if (context.startTime && context.endTime) {
		where.createTime = _.and(_.gte(context.startTime), _.lte(context.endTime))
	}
	const res = await db.collection('Items').where(where)
		.orderBy('createTime', 'desc')
		.limit(context.relatedLimit)
		.get()
	let items = Array.isArray(res.data) ? res.data : []
	if (context.itemIds.length > 0) {
		const itemIdSet = new Set(context.itemIds)
		items = prioritizeRelated(items, item => itemIdSet.has(item._id))
	}
	if (context.itemNames.length > 0) {
		const itemNameSet = new Set(context.itemNames)
		items = prioritizeRelated(items, item => itemNameSet.has(item.name))
	}
	return items
}

async function getRelatedUseRecords(userId, context) {
	const where = { userId, type: 'gift_use' }
	if (context.startTime && context.endTime) {
		where.createTime = _.and(_.gte(context.startTime), _.lte(context.endTime))
	}
	const res = await db.collection('Records').where(where)
		.orderBy('createTime', 'desc')
		.limit(context.relatedLimit)
		.get()
	let records = Array.isArray(res.data) ? res.data : []
	if (context.itemIds.length > 0) {
		const itemIdSet = new Set(context.itemIds)
		records = prioritizeRelated(records, record => {
			const itemId = normalizeString(record.itemId || record.giftId)
			return itemIdSet.has(itemId)
		})
	}
	if (context.itemNames.length > 0) {
		const itemNameSet = new Set(context.itemNames)
		records = prioritizeRelated(records, record => itemNameSet.has(extractUseItemName(record.reason)))
	}
	return records
}

async function getRelatedUseNotices(userId, allowedUserIds, context) {
	const res = await db.collection('Notices').where(
		_.or([
			{ type: 'GIFT_USED', senderId: userId },
			{ type: 'GIFT_USED', receiverId: userId }
		])
	)
		.orderBy('createTime', 'desc')
		.limit(context.relatedLimit)
		.get()

	const allowedSet = new Set(Array.isArray(allowedUserIds) ? allowedUserIds : [])
	let notices = (Array.isArray(res.data) ? res.data : []).filter(notice => {
		const senderAllowed = allowedSet.has(notice.senderId)
		const receiverAllowed = !notice.receiverId || allowedSet.has(notice.receiverId)
		if (!senderAllowed || !receiverAllowed) return false
		if (context.startTime && context.endTime) {
			const ts = toTimestamp(notice.createTime)
			if (ts < toTimestamp(context.startTime) || ts > toTimestamp(context.endTime)) {
				return false
			}
		}
		return true
	})
	if (context.itemIds.length > 0) {
		const itemIdSet = new Set(context.itemIds)
		notices = prioritizeRelated(notices, notice => itemIdSet.has(normalizeString(notice.itemId || notice.giftId)))
	}
	if (context.itemNames.length > 0) {
		const itemNameSet = new Set(context.itemNames)
		notices = prioritizeRelated(notices, notice => itemNameSet.has(extractNoticeItemName(notice.message)))
	}
	return notices
}

function prioritizeRelated(list, matcher) {
	const matched = []
	const others = []
	for (const item of list) {
		if (matcher(item)) matched.push(item)
		else others.push(item)
	}
	return [...matched, ...others]
}

async function integrateData(userId, purchaseRecords, items, useRecords, notices) {
	const result = []

	const itemById = new Map()
	const itemsByName = new Map()
	const usedItemIds = new Set()

	for (const item of items) {
		itemById.set(item._id, item)
		pushToGroup(itemsByName, item.name, item)
	}

	const useRecordByItemId = new Map()
	const useRecordsByName = new Map()
	const usedUseRecordIds = new Set()

	for (const record of useRecords) {
		const directItemId = resolveItemIdFromRecord(record, itemById)
		if (directItemId && !useRecordByItemId.has(directItemId)) {
			useRecordByItemId.set(directItemId, record)
		}
		pushToGroup(useRecordsByName, extractUseItemName(record.reason), record)
	}

	const noticeByItemId = new Map()
	const noticesByName = new Map()
	const usedNoticeIds = new Set()

	for (const notice of notices) {
		const noticeItemId = resolveItemIdFromNotice(notice, itemById)
		if (noticeItemId && !noticeByItemId.has(noticeItemId)) {
			noticeByItemId.set(noticeItemId, notice)
		}
		pushToGroup(noticesByName, extractNoticeItemName(notice.message), notice)
	}

	if (itemsByName.size > 0) sortGroupedByCreateTime(itemsByName)
	if (useRecordsByName.size > 0) sortGroupedByCreateTime(useRecordsByName)
	if (noticesByName.size > 0) sortGroupedByCreateTime(noticesByName)

	const userIds = new Set()
	for (const record of purchaseRecords) userIds.add(record.userId)
	for (const record of useRecords) userIds.add(record.userId)
	for (const notice of notices) {
		userIds.add(notice.senderId)
		userIds.add(notice.receiverId)
	}

	const usersMap = await getUsersInfo(Array.from(userIds))

	for (const purchaseRecord of purchaseRecords) {
		const itemName = extractPurchaseItemName(purchaseRecord.reason)

		const item = resolveItem({
			purchaseRecord,
			itemName,
			itemById,
			itemsByName,
			usedItemIds
		})

		const useRecord = resolveUseRecord({
			item,
			itemName,
			purchaseRecord,
			useRecordByItemId,
			useRecordsByName,
			usedUseRecordIds
		})

		const notice = resolveNotice({
			item,
			itemName,
			purchaseRecord,
			useRecord,
			itemById,
			noticeByItemId,
			noticesByName,
			usedNoticeIds
		})

		const historyItem = {
			_id: item?._id || `virtual_${purchaseRecord._id}`,
			name: itemName,
			image: item?.image || '',
			giftId: item?.sourceGiftId || purchaseRecord.giftId || '',
			points: Math.abs(purchaseRecord.amount),
			status: item?.status || 'deleted',
			createTime: purchaseRecord.createTime,
			isDeleted: !item,
			purchaseRecord: {
				_id: purchaseRecord._id,
				amount: purchaseRecord.amount,
				createTime: purchaseRecord.createTime,
				operator: getUserName(usersMap, purchaseRecord.userId, userId)
			}
		}

		if (useRecord) {
			historyItem.useRecord = {
				_id: useRecord._id,
				useTime: item?.useTime || useRecord.createTime,
				operator: getUserName(usersMap, notice?.senderId || useRecord.userId, userId),
				receiver: getUserName(usersMap, notice?.receiverId, userId),
				message: notice?.message || ''
			}
		}

		result.push(historyItem)
	}

	return resolveGiftCovers(result)
}

/**
 * 补全历史记录的礼品封面图
 * 通过 giftId 或名称查找 Gifts 集合中的 coverImg，
 * 直接返回 cloud:// 文件 ID（Image 组件原生支持）。
 */
async function resolveGiftCovers(historyList) {
	const allGiftIds = [...new Set(historyList.map(item => item.giftId).filter(Boolean))]
	const missingGiftNameList = [...new Set(
		historyList
			.filter(item => !item.giftId && item.name)
			.map(item => item.name)
	)]

	if (allGiftIds.length === 0 && missingGiftNameList.length === 0) {
		return historyList
	}

	const giftCoverMap = new Map()
	if (allGiftIds.length > 0) {
		const batchSize = 20
		for (let i = 0; i < allGiftIds.length; i += batchSize) {
			const batch = allGiftIds.slice(i, i + batchSize)
			const giftRes = await db.collection('Gifts').where({ _id: _.in(batch) }).get().catch(() => ({ data: [] }))
			;(Array.isArray(giftRes.data) ? giftRes.data : []).forEach(gift => {
				if (gift.coverImg) giftCoverMap.set(gift._id, gift.coverImg)
			})
		}
	}

	const giftCoverByNameMap = new Map()
	if (missingGiftNameList.length > 0) {
		const giftRes = await db.collection('Gifts').where({ name: _.in(missingGiftNameList) }).get().catch(() => ({ data: [] }))
		const gifts = Array.isArray(giftRes.data) ? giftRes.data : []
		const bucketByName = new Map()

		for (const gift of gifts) {
			const giftName = normalizeString(gift && gift.name)
			if (!giftName || !gift.coverImg) continue
			const bucket = bucketByName.get(giftName) || []
			bucket.push(gift)
			bucketByName.set(giftName, bucket)
		}

		bucketByName.forEach((bucket, giftName) => {
			if (bucket.length === 1 && bucket[0].coverImg) {
				giftCoverByNameMap.set(giftName, bucket[0].coverImg)
			}
		})
	}

	return historyList.map(item => {
		const cover = giftCoverMap.get(item.giftId) || giftCoverByNameMap.get(item.name) || item.image || ''
		return { ...item, image: cover }
	})
}

function resolveItem({ purchaseRecord, itemName, itemById, itemsByName, usedItemIds }) {
	if (purchaseRecord.itemId && itemById.has(purchaseRecord.itemId)) {
		const directItem = itemById.get(purchaseRecord.itemId)
		usedItemIds.add(directItem._id)
		return directItem
	}

	const bucket = itemsByName.get(itemName) || []
	const matched = pickByNearestTime(bucket, purchaseRecord.createTime, usedItemIds)
	if (matched) usedItemIds.add(matched._id)
	return matched
}

function resolveUseRecord({ item, itemName, purchaseRecord, useRecordByItemId, useRecordsByName, usedUseRecordIds }) {
	if (item?._id && useRecordByItemId.has(item._id)) {
		const directRecord = useRecordByItemId.get(item._id)
		if (!usedUseRecordIds.has(directRecord._id)) {
			usedUseRecordIds.add(directRecord._id)
			return directRecord
		}
	}

	const bucket = useRecordsByName.get(itemName) || []
	const matched = pickByNearestTime(bucket, purchaseRecord.createTime, usedUseRecordIds)
	if (matched) usedUseRecordIds.add(matched._id)
	return matched
}

function resolveNotice({ item, itemName, purchaseRecord, useRecord, itemById, noticeByItemId, noticesByName, usedNoticeIds }) {
	const relatedItemId = resolveRelatedItemId(item, useRecord, itemById)
	if (relatedItemId && noticeByItemId.has(relatedItemId)) {
		const directNotice = noticeByItemId.get(relatedItemId)
		if (!usedNoticeIds.has(directNotice._id)) {
			usedNoticeIds.add(directNotice._id)
			return directNotice
		}
	}

	const bucket = noticesByName.get(itemName) || []
	const baseTime = useRecord?.createTime || purchaseRecord.createTime
	const matched = pickByNearestTime(bucket, baseTime, usedNoticeIds)
	if (matched) usedNoticeIds.add(matched._id)
	return matched
}

function resolveItemIdFromRecord(record, itemById) {
	if (!record) return ''
	if (record.itemId) return String(record.itemId)
	if (record.giftId && itemById.has(record.giftId)) return String(record.giftId)
	return ''
}

function resolveItemIdFromNotice(notice, itemById) {
	if (!notice) return ''
	if (notice.itemId) return String(notice.itemId)
	if (notice.giftId && itemById.has(notice.giftId)) return String(notice.giftId)
	return ''
}

function resolveRelatedItemId(item, useRecord, itemById) {
	if (item?._id) return item._id
	if (useRecord?.itemId) return useRecord.itemId
	if (useRecord?.giftId && itemById.has(useRecord.giftId)) return useRecord.giftId
	return ''
}

async function getUsersInfo(userIds) {
	const usersMap = new Map()
	const validUserIds = userIds.filter(Boolean)
	if (validUserIds.length === 0) return usersMap

	const batchSize = 20
	for (let i = 0; i < validUserIds.length; i += batchSize) {
		const batch = validUserIds.slice(i, i + batchSize)
		if (batch.length === 0) continue
		const res = await db.collection('Users').where({ _id: _.in(batch) }).get()
		;(Array.isArray(res.data) ? res.data : []).forEach(user => {
			usersMap.set(user._id, user)
		})
	}

	return usersMap
}

function getUserName(usersMap, targetId, currentUserId) {
	if (!targetId) return '未知'
	if (targetId === currentUserId) return '我'
	const user = usersMap.get(targetId)
	return user?.nickName || '对方'
}

function filterHistoryList(list, filter) {
	switch (filter) {
		case 'unused':
			return list.filter(item => item.status === 'unused' && !item.useRecord)
		case 'used':
			return list.filter(item => item.status === 'used' || !!item.useRecord)
		case 'all':
		default:
			return list
	}
}

function extractPurchaseItemName(reason) {
	return String(reason || '').replace(/^兑换[：:]\s*/, '').trim()
}

function extractUseItemName(reason) {
	return String(reason || '').replace(/^\[兑换请求\]\s*/, '').trim()
}

function extractNoticeItemName(message) {
	return String(message || '').replace(/^对方想要使用[：:]\s*/, '').trim()
}

function pushToGroup(map, key, value) {
	if (!key) return
	if (!map.has(key)) map.set(key, [])
	map.get(key).push(value)
}

function sortGroupedByCreateTime(groupedMap) {
	groupedMap.forEach(list => {
		list.sort((a, b) => toTimestamp(b.createTime) - toTimestamp(a.createTime))
	})
}

function pickByNearestTime(candidates, baseTime, usedIdSet) {
	if (!Array.isArray(candidates) || candidates.length === 0) return null
	const baseTimestamp = toTimestamp(baseTime)
	let bestCandidate = null
	let bestDiff = Number.MAX_SAFE_INTEGER

	for (const candidate of candidates) {
		if (!candidate?._id || usedIdSet.has(candidate._id)) continue
		const diff = Math.abs(toTimestamp(candidate.createTime) - baseTimestamp)
		if (diff < bestDiff) {
			bestDiff = diff
			bestCandidate = candidate
		}
	}

	return bestCandidate
}

function toTimestamp(value) {
	const ts = new Date(value).getTime()
	return Number.isFinite(ts) ? ts : 0
}
