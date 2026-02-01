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

      // 写入通知：提醒任务发布者（creatorId），对方已经完成了任务
      // 这里的逻辑是：如果完成者是 targetId，通知 creatorId
      if (OPENID === (task.targetId || OPENID) && task.creatorId !== OPENID) {
        await transaction.collection('Notices').add({
          data: {
            type: 'TASK_DONE',
            title: '🎉 任务已完成',
            message: `对方完成了任务：${task.title}`,
            points: task.type === 'reward' ? task.points : 0,
            senderId: OPENID,
            receiverId: task.creatorId,
            read: false,
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
