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

  try {
    // 性能优化：并行获取发布者资料
    const userRes = await db.collection('Users').doc(OPENID).get().catch(() => ({ data: {} }))
    const { partnerId } = userRes.data || {}

    if (!partnerId) return { success: false, message: '请先绑定伙伴' }

    const targetId = customTargetId || (type === 'reward' ? OPENID : partnerId)
    const pointsNum = Math.abs(parseInt(points)) || 0 // 确保为正整数

    const newTask = {
      title,
      points: pointsNum,
      type,
      status: type === 'reward' ? 'pending' : 'done',
      creatorId: OPENID,
      targetId,
      createTime: db.serverDate()
    }

    // 全量使用事务处理，确保任务与通知的原子性
    return await db.runTransaction(async transaction => {
      // 1. 如果是惩罚任务，原子扣除积分并记录流水
      if (type === 'penalty') {
        await transaction.collection('Users').doc(targetId).update({
          data: { totalPoints: _.inc(-pointsNum) }
        })

        await transaction.collection('Records').add({
          data: {
            userId: targetId,
            amount: -pointsNum,
            reason: `[惩罚] ${title}`,
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
          title: type === 'reward' ? '✨ 收到新任务' : '💢 收到惩罚任务',
          message: title,
          points: type === 'reward' ? pointsNum : -pointsNum,
          senderId: OPENID,
          receiverId: targetId,
          read: false,
          createTime: db.serverDate()
        }
      })

      // 4. 发送微信订阅消息 (异步执行，不阻塞事务)
      try {
        const taskTitle = safeTruncate(title, 20)
        const nickName = safeTruncate(userRes.data.nickName, 10)
        
        await cloud.openapi.subscribeMessage.send({
          touser: targetId,
          templateId: 'BDmFGTb7vGdwB_BX1k6DGrqfRt2yl_dReh_ar3g8CN0', // 备忘录任务提醒 (新任务)
          page: 'pages/index/index',
          data: {
            thing1: { value: taskTitle },
            name2: { value: nickName || '对方' },
            time3: { value: dayjs().format('YYYY年MM月DD日 HH:mm') }
          }
        })
      } catch (sendError) {
        console.warn('订阅消息发送失败', sendError)
      }

      return { success: true, id: addRes._id }
    })
  } catch (e) {
    console.error('发布任务失败', e)
    // 统一返回 message 字段，方便前端展示
    return { success: false, message: e.message || '系统繁忙，请稍后再试' }
  }
}
