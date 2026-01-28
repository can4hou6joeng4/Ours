const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { page = 1, pageSize = 50 } = event

  try {
    const skip = (page - 1) * pageSize

    // 适配现有数据库 schema: userId, createTime
    const recordsRes = await db.collection('Records')
      .where({
        userId: OPENID
      })
      .orderBy('createTime', 'desc')
      .skip(skip)
      .limit(pageSize)
      .get()

    return {
      success: true,
      data: recordsRes.data
    }
  } catch (e) {
    console.error('获取记录失败', e)
    return {
      success: false,
      error: e.message
    }
  }
}
