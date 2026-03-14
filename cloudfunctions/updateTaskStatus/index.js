const cloud = require('wx-server-sdk')
const dayjs = require('dayjs')
const {
  normalizeString,
  normalizeOptionalRequestId
} = require('./shared/validation')
const {
  assertTaskCreator,
  assertTaskExecutor,
  getTaskExecutorId
} = require('./shared/authz')
const { runWithIdempotencyTransaction } = require('./shared/idempotency')
const { changeUserPoints } = require('./shared/points')
const { safeTruncate } = require('./shared/utils')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

function fail(message) {
  return { success: false, message }
}

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const taskId = normalizeString(event && event.taskId)
  const action = normalizeString(event && event.action) || undefined
  let requestId = ''

  if (!taskId) return fail('任务 ID 不能为空')
  if (action && action !== 'submit' && action !== 'confirm') {
    return fail('操作类型不合法')
  }

  try {
    requestId = normalizeOptionalRequestId(event && event.requestId)
  } catch (validationError) {
    return fail(validationError.message)
  }

  try {
    const txResult = await runWithIdempotencyTransaction({
      db,
      openid: OPENID,
      scope: 'updateTaskStatus',
      requestId,
      work: async transaction => {
        const taskRes = await transaction.collection('Tasks').doc(taskId).get().catch(() => null)
        const task = taskRes && taskRes.data ? taskRes.data : null
        if (!task) throw new Error('任务不存在')

        if (action === 'submit') {
          if (task.status !== 'pending') throw new Error('任务状态异常')
          assertTaskExecutor(task, OPENID, '只有任务执行者可以提交完成')

          await transaction.collection('Tasks').doc(taskId).update({
            data: {
              status: 'waiting_confirmation',
              submitTime: db.serverDate()
            }
          })

          if (task.creatorId && task.creatorId !== OPENID) {
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

          const response = {
            success: true,
            status: 'waiting_confirmation',
            points: 0,
            subscribePayload:
              task.creatorId && task.creatorId !== OPENID
                ? { touser: task.creatorId, taskTitle: safeTruncate(task.title, 20), statusText: '待验收' }
                : null
          }
          if (requestId) response.requestId = requestId
          return response
        }

        const isLegacyConfirm = action === undefined
        const shouldConfirm =
          action === 'confirm' ||
          (isLegacyConfirm && (task.status === 'pending' || task.status === 'waiting_confirmation'))

        if (!shouldConfirm) throw new Error('未知的操作类型')

        const validStatus = action === 'confirm' ? 'waiting_confirmation' : 'pending'
        if (task.status !== validStatus) {
          if (!(isLegacyConfirm && task.status === 'waiting_confirmation')) {
            throw new Error(`任务状态异常: ${task.status}`)
          }
        }

        assertTaskCreator(task, OPENID, '只有任务发布者可以确认完成')

        await transaction.collection('Tasks').doc(taskId).update({
          data: {
            status: 'done',
            confirmTime: db.serverDate(),
            completeTime: db.serverDate()
          }
        })

        const rawTaskPoints = Number(task.points)
        const rewardPoints = task.type === 'reward' && Number.isInteger(rawTaskPoints) && rawTaskPoints > 0 ? rawTaskPoints : 0

        let balanceAfter
        if (rewardPoints > 0) {
          const executorId = getTaskExecutorId(task)
          const pointsMutation = await changeUserPoints({ transaction, userId: executorId, delta: rewardPoints })
          balanceAfter = pointsMutation.balanceAfter

          await transaction.collection('Records').add({
            data: {
              userId: executorId,
              type: 'task_done',
              amount: rewardPoints,
              balanceAfter,
              reason: `[完成] ${task.title}`,
              createTime: db.serverDate()
            }
          })
        }

        const executorId = getTaskExecutorId(task)
        if (executorId && executorId !== OPENID) {
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

        const response = {
          success: true,
          status: 'done',
          points: rewardPoints,
          subscribePayload:
            executorId && executorId !== OPENID
              ? { touser: executorId, taskTitle: safeTruncate(task.title, 20), statusText: '已验收' }
              : null
        }
        if (typeof balanceAfter === 'number') response.balanceAfter = balanceAfter
        if (requestId) response.requestId = requestId
        return response
      }
    })

    if (!txResult.__idempotencyReplay && txResult.subscribePayload) {
      try {
        await cloud.openapi.subscribeMessage.send({
          touser: txResult.subscribePayload.touser,
          templateId: 'BDmFGTb7vGdwB_BX1k6DGlsnq1YEpEDEy8n2y8g41_E',
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

    const { subscribePayload, __idempotencyReplay, ...result } = txResult || {}
    return result
  } catch (e) {
    console.error('更新任务失败', e)
    return { success: false, message: e.message }
  }
}
