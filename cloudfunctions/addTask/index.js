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
 * 任务发布与即时扣分逻辑
 * event: { title, points, type }
 */
exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { title, points, type, targetId: customTargetId } = event
  const normalizedTitle = String(title || '').trim()
  const normalizedType = type === 'reward' || type === 'penalty' ? type : ''
  const rawPoints = String(points ?? '').trim()
  const parsedPoints = Number(rawPoints)

  if (!normalizedTitle) return { success: false, message: '任务描述不能为空' }
  if (normalizedTitle.length > 40) return { success: false, message: '任务描述不能超过 40 字' }
  if (!normalizedType) return { success: false, message: '任务类型不合法' }
  if (!/^\d+$/.test(rawPoints) || !Number.isInteger(parsedPoints) || parsedPoints <= 0) {
    return { success: false, message: '积分必须是正整数' }
  }
  if (parsedPoints > 9999) return { success: false, message: '积分不能超过 9999' }

  try {
    // 性能优化：并行获取发布者资料
    const userRes = await db.collection('Users').doc(OPENID).get().catch(() => ({ data: {} }))
    const { partnerId } = userRes.data || {}

    if (!partnerId) return { success: false, message: '请先绑定伙伴' }
    if (partnerId === OPENID) return { success: false, message: '伙伴信息异常，请重新绑定' }
    if (customTargetId && customTargetId !== partnerId) {
      return { success: false, message: '目标用户不合法' }
    }

    const targetId = partnerId
    const pointsNum = parsedPoints

    const newTask = {
      title: normalizedTitle,
      points: pointsNum,
      type: normalizedType,
      status: normalizedType === 'reward' ? 'pending' : 'done',
      creatorId: OPENID,
      targetId,
      executorId: targetId, // 明确执行者
      createTime: db.serverDate()
    }

    // 事务仅处理数据库写入，避免外部调用放大事务失败面
    const txResult = await db.runTransaction(async transaction => {
      // 1. 如果是惩罚任务，原子扣除积分并记录流水
      if (normalizedType === 'penalty') {
        await transaction.collection('Users').doc(targetId).update({
          data: { totalPoints: _.inc(-pointsNum) }
        })

        await transaction.collection('Records').add({
          data: {
            userId: targetId,
            amount: -pointsNum,
            reason: `[惩罚] ${normalizedTitle}`,
            type: 'penalty',
            createTime: db.serverDate()
          }
        })
      }

      // 2. 创建任务记录
      const addRes = await transaction.collection('Tasks').add({ data: newTask })

      // 3. 写入通知记录 (确保 Notice 集合已创建)
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

      return {
        success: true,
        id: addRes._id,
        subscribePayload: {
          touser: targetId,
          taskTitle: safeTruncate(normalizedTitle, 20),
          creatorName: safeTruncate(userRes.data.nickName, 20) || '对方'
        }
      }
    })

    // 事务提交后再发订阅消息，不影响主流程成功
    if (txResult?.subscribePayload) {
      try {
        await cloud.openapi.subscribeMessage.send({
          touser: txResult.subscribePayload.touser,
          templateId: 'BDmFGTb7vGdwB_BX1k6DGrqfRt2yl_dReh_ar3g8CN0', // 备忘录任务提醒 (新任务)
          page: 'pages/index/index',
          data: {
            thing1: { value: txResult.subscribePayload.taskTitle },   // 任务名称
            thing6: { value: txResult.subscribePayload.creatorName }, // 创建人
            time4: { value: dayjs().format('YYYY年MM月DD日 HH:mm') }  // 开始时间
          }
        })
      } catch (sendError) {
        console.warn('订阅消息发送失败', sendError)
      }
    }

    const { subscribePayload, ...result } = txResult || {}
    return result
  } catch (e) {
    console.error('发布任务失败', e)
    // 统一返回 message 字段，方便前端展示
    return { success: false, message: e.message || '系统繁忙，请稍后再试' }
  }
}
