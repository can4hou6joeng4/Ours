const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()

  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // 【云开发控制台索引建议】
    // 集合：Users — _id 为主键，无需额外索引
    // 集合：Records — 建议索引 { userId: 1, createTime: -1 }
    // 性能优化点：通过 Promise.all 并行执行"用户信息查询"与"今日流水聚合"
    // 耗时从 T1 + T2 降至 Max(T1, T2)
    const [userRes, recordsRes] = await Promise.all([
      db.collection('Users').doc(OPENID).get().catch(() => null),
      db.collection('Records').where({
        userId: OPENID,
        createTime: _.gte(today)
      }).get().catch(() => ({ data: [] }))
    ])

    if (userRes) {
      const todayChange = recordsRes.data.reduce((sum, record) => sum + (record.amount || 0), 0)

      return {
        success: true,
        user: userRes.data,
        todayChange
      }
    }

    // 如果不存在，则创建新用户
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
