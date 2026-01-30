const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()

  try {
    // 性能优化点：直接通过 OPENID 匹配 creatorId 或 targetId，无需先查用户表获取 partnerId
    // 这能节省一次约 100ms-200ms 的数据库往返耗时
    const tasksRes = await db.collection('Tasks')
      .where(_.or([
        { creatorId: OPENID },
        { targetId: OPENID }
      ]))
      .orderBy('createTime', 'desc')
      .limit(100) // 增加限制，防止数据过载
      .get()

    return {
      success: true,
      tasks: tasksRes.data
    }
  } catch (e) {
    console.error('获取任务失败', e)
    return { success: false, error: e.message }
  }
}
