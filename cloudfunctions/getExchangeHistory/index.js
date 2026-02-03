const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

/**
 * 获取兑换历史记录
 * event: { page, pageSize, filter }
 * filter: 'all' | 'unused' | 'used'
 */
exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { page = 1, pageSize = 20, filter = 'all' } = event

  try {
    // 并行查询所有相关数据
    const [purchaseRecords, items, useRecords, notices] = await Promise.all([
      getPurchaseRecords(OPENID),
      getItems(OPENID),
      getUseRecords(OPENID),
      getUseNotices(OPENID)
    ])

    // 整合数据
    const historyList = await integrateData(
      OPENID,
      purchaseRecords,
      items,
      useRecords,
      notices
    )

    // 筛选和分页
    const filteredList = filterHistoryList(historyList, filter)
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
      error: e.message
    }
  }
}

/**
 * 获取购买记录
 */
async function getPurchaseRecords(userId) {
  const res = await db.collection('Records')
    .where({
      userId,
      type: 'outcome',
      reason: db.RegExp({
        regexp: '^兑换:'
      })
    })
    .orderBy('createTime', 'desc')
    .get()

  return res.data
}

/**
 * 获取物品记录
 */
async function getItems(userId) {
  const res = await db.collection('Items')
    .where({
      userId
    })
    .orderBy('createTime', 'desc')
    .get()

  return res.data
}

/**
 * 获取使用记录
 */
async function getUseRecords(userId) {
  const res = await db.collection('Records')
    .where({
      userId,
      type: 'gift_use'
    })
    .orderBy('createTime', 'desc')
    .get()

  return res.data
}

/**
 * 获取使用通知
 */
async function getUseNotices(userId) {
  const res = await db.collection('Notices')
    .where({
      type: 'GIFT_USED',
      _or: [
        { senderId: userId },
        { receiverId: userId }
      ]
    })
    .orderBy('createTime', 'desc')
    .get()

  return res.data
}

/**
 * 整合数据，构建完整的物品生命周期
 */
async function integrateData(userId, purchaseRecords, items, useRecords, notices) {
  const result = []

  // 1. 创建物品映射（用于快速查找）
  const itemsMap = new Map()
  items.forEach(item => {
    itemsMap.set(item.name, item)
  })

  // 2. 查询用户昵称（用于显示操作人）
  const userIds = new Set()

  // 收集需要查询的用户 ID
  purchaseRecords.forEach(record => {
    userIds.add(record.userId)
  })
  useRecords.forEach(record => {
    userIds.add(record.userId)
  })
  notices.forEach(notice => {
    userIds.add(notice.senderId)
    userIds.add(notice.receiverId)
  })

  // 批量查询用户信息
  const usersMap = await getUsersInfo(Array.from(userIds))

  // 3. 处理每个购买记录
  for (const record of purchaseRecords) {
    const itemName = record.reason.replace('兑换:', '').trim()
    const item = itemsMap.get(itemName)

    // 构建历史项
    const historyItem = {
      _id: item?._id || `virtual_${record._id}`,
      name: itemName,
      image: item?.image || '',
      points: Math.abs(record.amount),
      status: item?.status || 'deleted',
      createTime: record.createTime,
      isDeleted: !item,

      // 购买记录
      purchaseRecord: {
        _id: record._id,
        amount: record.amount,
        createTime: record.createTime,
        operator: getUserName(usersMap, record.userId, userId)
      }
    }

    // 4. 关联使用记录
    const useRecord = useRecords.find(r =>
      r.reason.includes(`[兑换请求] ${itemName}`)
    )

    if (useRecord) {
      const notice = notices.find(n =>
        n.message.includes(itemName)
      )

      historyItem.useRecord = {
        _id: useRecord._id,
        useTime: item?.useTime || useRecord.createTime,
        operator: getUserName(usersMap, notice?.senderId, userId),
        receiver: getUserName(usersMap, notice?.receiverId, userId),
        message: notice?.message || ''
      }
    }

    result.push(historyItem)
  }

  return result
}

/**
 * 批量查询用户信息
 */
async function getUsersInfo(userIds) {
  const usersMap = new Map()

  // 分批查询（云开发限制每次最多 20 条）
  const batchSize = 20
  for (let i = 0; i < userIds.length; i += batchSize) {
    const batch = userIds.slice(i, i + batchSize)
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

/**
 * 获取用户昵称
 */
function getUserName(usersMap, targetId, currentUserId) {
  if (!targetId) return '未知'
  if (targetId === currentUserId) return '我'

  const user = usersMap.get(targetId)
  return user?.nickName || '对方'
}

/**
 * 筛选历史列表
 */
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

/**
 * 分页处理
 */
function paginateList(list, page, pageSize) {
  const start = (page - 1) * pageSize
  const end = start + pageSize
  return list.slice(start, end)
}
