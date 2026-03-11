const cloud = require('wx-server-sdk')
const dayjs = require('dayjs')
const {
  normalizeString,
  ensureEnum,
  parsePositiveInteger,
  normalizeOptionalRequestId
} = require('./shared/validation')
const { assertBoundPartner } = require('./shared/authz')
const { runWithIdempotencyTransaction } = require('./shared/idempotency')
const { changeUserPoints } = require('./shared/points')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

function safeTruncate(text, maxLength) {
  if (!text) return ''
  const truncated = text.toString().substring(0, maxLength)
  return truncated + (text.toString().length > maxLength ? '...' : '')
}

function fail(message) {
  return { success: false, message }
}

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const normalizedTitle = normalizeString(event && event.title)
  const normalizedType = normalizeString(event && event.type)
  const customTargetId = normalizeString(event && event.targetId)
  let pointsNum = 0
  let requestId = ''

  try {
    if (!normalizedTitle) return fail('任务描述不能为空')
    if (normalizedTitle.length > 40) return fail('任务描述不能超过 40 字')
    ensureEnum(normalizedType, ['reward', 'penalty'], '任务类型不合法')
    pointsNum = parsePositiveInteger(event && event.points, {
      invalidMessage: '积分必须是正整数',
      max: 9999,
      maxMessage: '积分不能超过 9999'
    })
    requestId = normalizeOptionalRequestId(event && event.requestId)
  } catch (validationError) {
    return fail(validationError.message)
  }

  try {
    const userRes = await db.collection('Users').doc(OPENID).get().catch(() => ({ data: {} }))
    const partnerId = assertBoundPartner(userRes.data || {}, OPENID)
    if (customTargetId && customTargetId !== partnerId) {
      return fail('目标用户不合法')
    }

    const targetId = partnerId
    const txResult = await runWithIdempotencyTransaction({
      db,
      openid: OPENID,
      scope: 'addTask',
      requestId,
      work: async transaction => {
        const newTask = {
          title: normalizedTitle,
          points: pointsNum,
          type: normalizedType,
          status: normalizedType === 'reward' ? 'pending' : 'done',
          creatorId: OPENID,
          targetId,
          executorId: targetId,
          createTime: db.serverDate()
        }

        let pointsMutation = null
        if (normalizedType === 'penalty') {
          pointsMutation = await changeUserPoints({
            transaction,
            userId: targetId,
            delta: -pointsNum,
            insufficientMessage: '积分不足'
          })

          await transaction.collection('Records').add({
            data: {
              userId: targetId,
              amount: -pointsNum,
              balanceAfter: pointsMutation.balanceAfter,
              reason: `[惩罚] ${normalizedTitle}`,
              type: 'penalty',
              createTime: db.serverDate()
            }
          })
        }

        const addRes = await transaction.collection('Tasks').add({ data: newTask })

        await transaction.collection('Notices').add({
          data: {
            type: 'NEW_TASK',
            title: normalizedType === 'reward' ? '✨ 收到新任务' : '💢 收到惩罚任务',
            message: normalizedTitle,
            points: normalizedType === 'reward' ? pointsNum : -pointsNum,
            senderId: OPENID,
            receiverId: targetId,
            read: false,
            createTime: db.serverDate()
          }
        })

        const response = {
          success: true,
          id: addRes._id,
          subscribePayload: {
            touser: targetId,
            taskTitle: safeTruncate(normalizedTitle, 20),
            creatorName: safeTruncate(userRes.data && userRes.data.nickName, 20) || '对方'
          }
        }
        if (pointsMutation) response.balanceAfter = pointsMutation.balanceAfter
        if (requestId) response.requestId = requestId
        return response
      }
    })

    if (!txResult.__idempotencyReplay && txResult.subscribePayload) {
      try {
        await cloud.openapi.subscribeMessage.send({
          touser: txResult.subscribePayload.touser,
          templateId: 'BDmFGTb7vGdwB_BX1k6DGrqfRt2yl_dReh_ar3g8CN0',
          page: 'pages/index/index',
          data: {
            thing1: { value: txResult.subscribePayload.taskTitle },
            thing6: { value: txResult.subscribePayload.creatorName },
            time4: { value: dayjs().format('YYYY年MM月DD日 HH:mm') }
          }
        })
      } catch (sendError) {
        console.warn('订阅消息发送失败', sendError)
      }
    }

    const { subscribePayload, __idempotencyReplay, ...result } = txResult || {}
    return result
  } catch (e) {
    console.error('发布任务失败', e)
    return { success: false, message: e.message || '系统繁忙，请稍后再试' }
  }
}
