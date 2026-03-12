const cloud = require('wx-server-sdk')
const { normalizeString } = require('./shared/validation')
const { resolveAccessibleUserId } = require('./shared/authz')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

const SUMMARY_FIELDS = {
  _id: true,
  type: true,
  amount: true,
  reason: true,
  createTime: true,
  balanceAfter: true
}

function normalizePage(value) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 1) return 1
  return Math.floor(parsed)
}

function normalizePageSize(value) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 1) return 50
  return Math.min(Math.floor(parsed), 100)
}

function normalizeTypes(event) {
  const singleType = normalizeString(event && event.type)
  const types = Array.isArray(event && event.types)
    ? event.types.map(item => normalizeString(item)).filter(Boolean)
    : []

  if (types.length > 0) {
    return Array.from(new Set(types))
  }

  if (singleType) {
    return [singleType]
  }

  return []
}

exports.main = async event => {
  const { OPENID } = cloud.getWXContext()
  const page = normalizePage(event && event.page)
  const pageSize = normalizePageSize(event && event.pageSize)
  const summaryOnly = !!(event && event.summaryOnly)
  const targetUserInput = normalizeString(event && (event.userId || event.targetUserId))
  const types = normalizeTypes(event)

  try {
    let targetUserId = OPENID
    if (targetUserInput && targetUserInput !== OPENID) {
      const userRes = await db.collection('Users').doc(OPENID).get().catch(() => null)
      const currentUser = userRes && userRes.data ? userRes.data : null
      targetUserId = resolveAccessibleUserId(currentUser, OPENID, targetUserInput)
    }

    const where = { userId: targetUserId }
    if (types.length === 1) {
      where.type = types[0]
    } else if (types.length > 1) {
      where.type = _.in(types)
    }

    const skip = (page - 1) * pageSize
    let query = db.collection('Records')
      .where(where)
      .orderBy('createTime', 'desc')
      .skip(skip)
      .limit(pageSize)

    if (summaryOnly) {
      query = query.field(SUMMARY_FIELDS)
    }

    const recordsRes = await query.get()

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
