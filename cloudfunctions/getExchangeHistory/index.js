const cloud = require('wx-server-sdk')
const { normalizeString } = require('./shared/validation')
const { getAllowedUserIds, resolveAccessibleUserId } = require('./shared/authz')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command
const QUERY_BATCH_SIZE = 100

/**
 * 获取兑换历史记录
 * event: { page, pageSize, filter }
 * filter: 'all' | 'unused' | 'used'
 */
exports.main = async (event, context) => {
	const { OPENID } = cloud.getWXContext()
	const { page = 1, pageSize = 20 } = event || {}
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

		const [purchaseRecords, items, useRecords, notices] = await Promise.all([
			getPurchaseRecords(targetUserId),
			getItems(targetUserId),
			getUseRecords(targetUserId),
			getUseNotices(targetUserId, allowedUserIds)
		])

		const historyList = await integrateData(
			OPENID,
			purchaseRecords,
			items,
			useRecords,
			notices
		)

		const filteredList = filterHistoryList(historyList, filterInput)
		const paginatedList = paginateList(filteredList, page, pageSize)

		return {
			success: true,
			data: paginatedList,
			total: filteredList.length,
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

async function getPurchaseRecords(userId) {
	return queryAllByCreateTimeDesc('Records', {
		userId,
		type: 'outcome',
		reason: db.RegExp({
			regexp: '^兑换:'
		})
	})
}

async function getItems(userId) {
	return queryAllByCreateTimeDesc('Items', { userId })
}

async function getUseRecords(userId) {
	return queryAllByCreateTimeDesc('Records', {
		userId,
		type: 'gift_use'
	})
}

async function getUseNotices(userId, allowedUserIds) {
	const notices = await queryAllByCreateTimeDesc(
		'Notices',
		_.or([
			{ type: 'GIFT_USED', senderId: userId },
			{ type: 'GIFT_USED', receiverId: userId }
		])
	)
	const allowedSet = new Set(Array.isArray(allowedUserIds) ? allowedUserIds : [])
	return notices.filter(notice => {
		const senderAllowed = allowedSet.has(notice.senderId)
		const receiverAllowed = !notice.receiverId || allowedSet.has(notice.receiverId)
		return senderAllowed && receiverAllowed
	})
}

async function queryAllByCreateTimeDesc(collectionName, whereCondition) {
	let skip = 0
	const merged = []

	while (true) {
		const res = await db.collection(collectionName)
			.where(whereCondition)
			.orderBy('createTime', 'desc')
			.skip(skip)
			.limit(QUERY_BATCH_SIZE)
			.get()

		const batch = Array.isArray(res.data) ? res.data : []
		merged.push(...batch)

		if (batch.length < QUERY_BATCH_SIZE) break
		skip += QUERY_BATCH_SIZE
	}

	return merged
}

async function integrateData(userId, purchaseRecords, items, useRecords, notices) {
  const result = []

  const itemById = new Map()
  const itemsByName = new Map()
  const usedItemIds = new Set()

  items.forEach(item => {
    itemById.set(item._id, item)
    pushToGroup(itemsByName, item.name, item)
  })

  const useRecordByItemId = new Map()
  const useRecordsByName = new Map()
  const usedUseRecordIds = new Set()

	useRecords.forEach(record => {
		const directItemId = resolveItemIdFromRecord(record, itemById)
		if (directItemId && !useRecordByItemId.has(directItemId)) {
			useRecordByItemId.set(directItemId, record)
		}
		pushToGroup(useRecordsByName, extractUseItemName(record.reason), record)
	})

  const noticeByItemId = new Map()
  const noticesByName = new Map()
  const usedNoticeIds = new Set()

	notices.forEach(notice => {
		const noticeItemId = resolveItemIdFromNotice(notice, itemById)
		if (noticeItemId && !noticeByItemId.has(noticeItemId)) {
			noticeByItemId.set(noticeItemId, notice)
		}
		pushToGroup(noticesByName, extractNoticeItemName(notice.message), notice)
	})

  // 预排序，保证兜底匹配稳定
  sortGroupedByCreateTime(itemsByName)
  sortGroupedByCreateTime(useRecordsByName)
  sortGroupedByCreateTime(noticesByName)

  // 收集需要查询的用户 ID
  const userIds = new Set()
  purchaseRecords.forEach(record => userIds.add(record.userId))
  useRecords.forEach(record => userIds.add(record.userId))
  notices.forEach(notice => {
    userIds.add(notice.senderId)
    userIds.add(notice.receiverId)
  })

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

  return await resolveImageUrls(result)
}

async function resolveImageUrls(historyList) {
  // 1) giftId 命中时，优先从 Gifts 重新取 coverImg
  const allGiftIds = [...new Set(historyList.map(item => item.giftId).filter(Boolean))]
  const giftCoverMap = new Map()

  if (allGiftIds.length > 0) {
    const batchSize = 20
    for (let i = 0; i < allGiftIds.length; i += batchSize) {
      const batch = allGiftIds.slice(i, i + batchSize)
      const giftRes = await db.collection('Gifts').where({ _id: db.command.in(batch) }).get().catch(() => ({ data: [] }))
      ;(Array.isArray(giftRes.data) ? giftRes.data : []).forEach(gift => {
        if (gift.coverImg) giftCoverMap.set(gift._id, gift.coverImg)
      })
    }
  }

  // 2) giftId 为空时，按名称兜底查 Gifts；仅唯一命中时才补图，避免同名误匹配
  const missingGiftNameList = [...new Set(
    historyList
      .filter(item => !item.giftId && item.name)
      .map(item => item.name)
  )]
  const giftCoverByNameMap = new Map()

  if (missingGiftNameList.length > 0) {
    const giftRes = await db.collection('Gifts').where({ name: db.command.in(missingGiftNameList) }).get().catch(() => ({ data: [] }))
    const gifts = Array.isArray(giftRes.data) ? giftRes.data : []
    const bucketByName = new Map()

    gifts.forEach(gift => {
      const giftName = normalizeString(gift && gift.name)
      if (!giftName || !gift.coverImg) return
      const bucket = bucketByName.get(giftName) || []
      bucket.push(gift)
      bucketByName.set(giftName, bucket)
    })

    bucketByName.forEach((bucket, giftName) => {
      if (bucket.length === 1 && bucket[0].coverImg) {
        giftCoverByNameMap.set(giftName, bucket[0].coverImg)
      }
    })
  }

  // 3) 收集所有 cloud:// 待换签文件
  const fileIdSet = new Set()
  historyList.forEach(item => {
    const src = giftCoverMap.get(item.giftId) || giftCoverByNameMap.get(item.name) || item.image || ''
    if (src.startsWith('cloud://')) fileIdSet.add(src)
  })

  const urlMap = new Map()
  const fileIds = [...fileIdSet]
  if (fileIds.length > 0) {
    const res = await cloud.getTempFileURL({ fileList: fileIds })
    ;(Array.isArray(res.fileList) ? res.fileList : []).forEach(f => {
      if (f.fileID && f.tempFileURL) urlMap.set(f.fileID, f.tempFileURL)
    })
  }

  return historyList.map(item => {
    const raw = giftCoverMap.get(item.giftId) || giftCoverByNameMap.get(item.name) || item.image || ''
    const resolvedImage = urlMap.get(raw) || (raw.startsWith('cloud://') ? '' : raw)
    return { ...item, image: resolvedImage }
  })
}

function resolveItem({
  purchaseRecord,
  itemName,
  itemById,
  itemsByName,
  usedItemIds
}) {
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

function resolveUseRecord({
  item,
  itemName,
  purchaseRecord,
  useRecordByItemId,
  useRecordsByName,
  usedUseRecordIds
}) {
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

function resolveNotice({
	item,
	itemName,
	purchaseRecord,
	useRecord,
	itemById,
	noticeByItemId,
	noticesByName,
	usedNoticeIds
}) {
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

	// 兼容历史数据：旧版 giftId 可能直接存储的是 itemId
	if (record.giftId && itemById.has(record.giftId)) {
		return String(record.giftId)
	}
	return ''
}

function resolveItemIdFromNotice(notice, itemById) {
	if (!notice) return ''
	if (notice.itemId) return String(notice.itemId)

	// 兼容历史数据：旧版 giftId 可能直接存储的是 itemId
	if (notice.giftId && itemById.has(notice.giftId)) {
		return String(notice.giftId)
	}
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

		const res = await db.collection('Users')
			.where({
				_id: _.in(batch)
			})
			.get()

		res.data.forEach(user => {
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
      return list.filter(item => item.status === 'unused')
    case 'used':
      return list.filter(item => item.status === 'used' || item.isDeleted)
    case 'all':
    default:
      return list
  }
}

function paginateList(list, page, pageSize) {
  const start = (page - 1) * pageSize
  const end = start + pageSize
  return list.slice(start, end)
}

function extractPurchaseItemName(reason) {
  return String(reason || '')
    .replace(/^兑换[：:]\s*/, '')
    .trim()
}

function extractUseItemName(reason) {
  return String(reason || '')
    .replace(/^\[兑换请求\]\s*/, '')
    .trim()
}

function extractNoticeItemName(message) {
  return String(message || '')
    .replace(/^对方想要使用[：:]\s*/, '')
    .trim()
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
