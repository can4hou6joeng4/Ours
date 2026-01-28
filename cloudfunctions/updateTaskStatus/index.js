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

      if (!task || task.status !== 'pending') {
        throw new Error('任务状态异常')
      }

      await transaction.collection('Tasks').doc(taskId).update({
        data: {
          status: 'done',
          completeTime: db.serverDate()
        }
      })

      if (task.type === 'reward') {
        const targetId = task.targetId || OPENID // 优先取任务目标，兼容旧数据
        await transaction.collection('Users').doc(targetId).update({
          data: {
            totalPoints: _.inc(task.points)
          }
        })

        await transaction.collection('Records').add({
          data: {
            userId: targetId,
            type: 'task_done',
            amount: task.points,
            reason: task.title,
            createTime: db.serverDate()
          }
        })
      }

      return { success: true, points: task.points }
    })
  } catch (e) {
    return { success: false, error: e.message }
  }
}
