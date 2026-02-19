const cloud = require('wx-server-sdk')
const dayjs = require('dayjs')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

function safeTruncate(text, maxLength) {
  if (!text) return ''
  const truncated = text.toString().substring(0, maxLength)
  return truncated + (text.toString().length > maxLength ? '...' : '')
}

/**
 * 任务状态更新逻辑 (支持流转)
 * event: { taskId, action }
 * action: 'submit' (提交完成) | 'confirm' (确认完成) | undefined (兼容旧版直接完成)
 */
exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { taskId, action } = event

  if (!taskId) return { success: false, message: '任务 ID 不能为空' }
  if (action && action !== 'submit' && action !== 'confirm') {
    return { success: false, message: '操作类型不合法' }
  }

  try {
    const txResult = await db.runTransaction(async transaction => {
      const taskRes = await transaction.collection('Tasks').doc(taskId).get()
      const task = taskRes.data

      if (!task) throw new Error('任务不存在')

      // 1. 提交完成 (执行者操作)
      if (action === 'submit') {
        if (task.status !== 'pending') throw new Error('任务状态异常')
        // 校验执行者权限：仅执行者可提交
        const executorId = task.executorId || task.targetId
        if (executorId !== OPENID) {
          throw new Error('只有任务执行者可以提交完成')
        }

        await transaction.collection('Tasks').doc(taskId).update({
          data: {
            status: 'waiting_confirmation',
            submitTime: db.serverDate()
          }
        })

        // 通知创建者去验收
        if (task.creatorId && task.creatorId !== OPENID) {
          // 站内信
          await transaction.collection('Notices').add({
            data: {
              type: 'TASK_CONFIRM',
              title: '👀 任务待验收',
              message: `对方已完成任务：${task.title}，请验收`,
              points: 0,
              senderId: OPENID,
              receiverId: task.creatorId,
              read: false,
              createTime: db.serverDate()
            }
          })
        }

        return {
          success: true,
          status: 'waiting_confirmation',
          points: 0,
          subscribePayload: task.creatorId && task.creatorId !== OPENID ? {
            touser: task.creatorId,
            taskTitle: safeTruncate(task.title, 20),
            statusText: '待验收'
          } : null
        }
      }

      // 2. 确认完成 (创建者操作)
      if (action === 'confirm' || (!action && task.status === 'pending')) {
        // 如果是 confirm 动作，要求状态是 waiting_confirmation
        // 如果没有 action (旧版逻辑)，要求状态是 pending
        const validStatus = action === 'confirm' ? 'waiting_confirmation' : 'pending'

        if (task.status !== validStatus) {
           // 特殊情况：如果是旧版逻辑调用，但状态已经是 waiting_confirmation，也允许通过（视为创建者直接确认）
           if (!(action === undefined && task.status === 'waiting_confirmation')) {
             throw new Error(`任务状态异常: ${task.status}`)
           }
        }

        // 校验创建者权限
        if (task.creatorId !== OPENID) {
          throw new Error('只有任务发布者可以确认完成')
        }

        await transaction.collection('Tasks').doc(taskId).update({
          data: {
            status: 'done',
            confirmTime: db.serverDate(),
            completeTime: db.serverDate()
          }
        })

        const rewardPoints = task.type === 'reward' ? task.points : 0

        // 结算积分
        if (task.type === 'reward') {
          const targetId = task.targetId || task.executorId
          await transaction.collection('Users').doc(targetId).update({
            data: { totalPoints: _.inc(task.points) }
          })

          await transaction.collection('Records').add({
            data: {
              userId: targetId,
              type: 'task_done',
              amount: task.points,
              reason: `[完成] ${task.title}`,
              createTime: db.serverDate()
            }
          })
        }

        // 通知执行者 (任务已验收/完成)
        const executorId = task.executorId || task.targetId
        if (executorId && executorId !== OPENID) {
          // 站内信
          await transaction.collection('Notices').add({
            data: {
              type: 'TASK_DONE',
              title: '🎉 任务已验收',
              message: `任务 ${task.title} 已验收，积分 +${rewardPoints}`,
              points: rewardPoints,
              senderId: OPENID,
              receiverId: executorId,
              read: false,
              createTime: db.serverDate()
            }
          })
        }

        return {
          success: true,
          status: 'done',
          points: rewardPoints,
          subscribePayload: executorId && executorId !== OPENID ? {
            touser: executorId,
            taskTitle: safeTruncate(task.title, 20),
            statusText: '已验收'
          } : null
        }
      }

      throw new Error('未知的操作类型')
    })

    // 事务提交后再发订阅消息，不影响业务主流程
    if (txResult?.subscribePayload) {
      try {
        await cloud.openapi.subscribeMessage.send({
          touser: txResult.subscribePayload.touser,
          templateId: 'BDmFGTb7vGdwB_BX1k6DGlsnq1YEpEDEy8n2y8g41_E', // 任务状态提醒
          page: 'pages/index/index',
          data: {
            thing1: { value: txResult.subscribePayload.taskTitle },
            short_thing8: { value: txResult.subscribePayload.statusText },
            character_string2: { value: dayjs().format('YYYY/MM/DD HH:mm') }
          }
        })
      } catch (sendError) {
        console.warn('发送任务状态通知失败', sendError)
      }
    }

    const { subscribePayload, ...result } = txResult || {}
    return result
  } catch (e) {
    console.error('更新任务失败', e)
    return { success: false, message: e.message }
  }
}
