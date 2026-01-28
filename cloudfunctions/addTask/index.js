const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

/**
 * 任务发布与即时扣分逻辑
 * event: { title, points, type }
 */
exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { title, points, type, targetId: customTargetId } = event

  try {
    const userRes = await db.collection('Users').doc(OPENID).get()
    const { partnerId } = userRes.data

    if (!partnerId) {
      return { success: false, message: '请先绑定伙伴后再发布任务' }
    }

    // 优先使用前端传入的 targetId，若无则根据类型兜底
    const targetId = customTargetId || (type === 'reward' ? OPENID : partnerId)
    const pointDelta = type === 'reward' ? 0 : -Number(points)

    // 2. 准备任务数据
    const newTask = {
      title,
      points: Number(points),
      type,
      status: type === 'reward' ? 'pending' : 'done',
      creatorId: OPENID,
      targetId,
      createTime: db.serverDate()
    }

    // 3. 事务处理：如果是惩罚，则扣分并记账
    const result = await db.runTransaction(async transaction => {
      if (type === 'penalty') {
        const targetUser = await transaction.collection('Users').doc(targetId).get()
        const currentPoints = targetUser.data.totalPoints || 0
        const newPoints = currentPoints + pointDelta

        // 更新用户总积分
        transaction.collection('Users').doc(targetId).update({
          data: { totalPoints: newPoints }
        })

        // 记录流水记录 (Records)
        transaction.collection('Records').add({
          data: {
            userId: targetId,
            amount: pointDelta,
            reason: `[惩罚] ${title}`,
            type: 'penalty',
            createTime: db.serverDate()
          }
        })
      }

      // 创建任务记录
      const addRes = await transaction.collection('Tasks').add({
        data: newTask
      })
      return addRes
    })

    return { success: true, id: result._id }
  } catch (e) {
    console.error(e)
    return { success: false, error: e.message }
  }
}
