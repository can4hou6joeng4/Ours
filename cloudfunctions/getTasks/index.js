const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()

  try {
    const myRes = await db.collection('Users').doc(OPENID).get()
    const partnerId = myRes.data.partnerId

    if (!partnerId) return { success: true, tasks: [] }

    const tasksRes = await db.collection('Tasks')
      .where(_.or([
        { creatorId: OPENID },
        { creatorId: partnerId }
      ]))
      .orderBy('createTime', 'desc')
      .get()

    return { success: true, tasks: tasksRes.data }
  } catch (e) {
    return { success: false, error: e.message }
  }
}
