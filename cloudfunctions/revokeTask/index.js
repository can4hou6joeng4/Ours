const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { taskId } = event

  try {
    return await db.runTransaction(async transaction => {
      const taskRes = await transaction.collection('Tasks').doc(taskId).get()
      const task = taskRes.data

      if (!task) throw new Error('任务不存在')
      if (task.creatorId !== OPENID) throw new Error('无权撤销该任务')
      if (task.status === 'revoked') throw new Error('任务已撤销')

      const { type, status, points, targetId, title } = task

      if (type === 'reward') {
        if (status === 'done') {
          // 奖赏已完成：扣回积分并记录流水
          await transaction.collection('Users').doc(targetId).update({
            data: { totalPoints: _.inc(-points) }
          })
          await transaction.collection('Records').add({
            data: {
              userId: targetId,
              type: 'revoke',
              amount: -points,
              reason: `[撤销奖赏] ${title}`,
              createTime: db.serverDate()
            }
          })
          // 重置为待完成
          await transaction.collection('Tasks').doc(taskId).update({
            data: {
              status: 'pending',
              revokeTime: db.serverDate()
            }
          })
        } else {
          // 奖赏待完成：直接设为已撤销
          await transaction.collection('Tasks').doc(taskId).update({
            data: {
              status: 'revoked',
              revokeTime: db.serverDate()
            }
          })
        }
      } else if (type === 'penalty') {
        // 惩罚任务：撤销时退回已扣除的积分
        await transaction.collection('Users').doc(targetId).update({
          data: { totalPoints: _.inc(points) }
        })
        await transaction.collection('Records').add({
          data: {
            userId: targetId,
            type: 'revoke',
            amount: points,
            reason: `[撤销惩罚] ${title}`,
            createTime: db.serverDate()
          }
        })
        await transaction.collection('Tasks').doc(taskId).update({
          data: {
            status: 'revoked',
            revokeTime: db.serverDate()
          }
        })
      }

      return { success: true }
    })
  } catch (e) {
    console.error(e)
    return { success: false, error: e.message }
  }
}
