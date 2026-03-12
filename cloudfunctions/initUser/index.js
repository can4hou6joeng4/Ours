const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()

  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // 高频入口：首页、历史页、背包页都会触发该接口。
    // 索引建议：Records 集合建立 { userId: 1, createTime: -1 }，降低今日流水查询成本。
    const userPromise = db.collection('Users').doc(OPENID).get().catch(() => null)

    let todayRecordsQuery = db.collection('Records').where({
      userId: OPENID,
      createTime: _.gte(today)
    })

    // 微信云开发支持 field 精简时，仅拉取 amount 字段，避免高频接口搬运无关字段。
    if (typeof todayRecordsQuery.field === 'function') {
      todayRecordsQuery = todayRecordsQuery.field({ amount: true })
    }

    const todayRecordsPromise = todayRecordsQuery.get().catch(() => ({ data: [] }))

    const [userRes, recordsRes] = await Promise.all([userPromise, todayRecordsPromise])

    if (userRes && userRes.data) {
      const todayChange = (Array.isArray(recordsRes.data) ? recordsRes.data : []).reduce(
        (sum, record) => sum + (record.amount || 0),
        0
      )

      return {
        success: true,
        user: userRes.data,
        todayChange
      }
    }

    const newUser = {
      _id: OPENID,
      totalPoints: 0,
      partnerId: '',
      createTime: db.serverDate()
    }

    await db.collection('Users').add({ data: newUser })
    return { success: true, user: newUser, todayChange: 0 }
  } catch (e) {
    console.error('初始化用户失败', e)
    return { success: false, message: '操作失败，请重试' }
  }
}
