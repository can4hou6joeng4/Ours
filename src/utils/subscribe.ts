import Taro from '@tarojs/taro'

// 订阅消息模板 ID 常量 (占位)
// 请在微信小程序管理后台申请后替换以下 ID
export const MSG_TEMPLATE_IDS = {
  NEW_TASK: 'BDmFGTb7vGdwB_BX1k6DGrqfRt2yl_dReh_ar3g8CN0',     // 新任务提醒
  TASK_DONE: 'BDmFGTb7vGdwB_BX1k6DGlsnq1YEpEDEy8n2y8g41_E',   // 任务完成提醒
  GIFT_USED: 'bxIAEflde73fD0hcYRnE6LkOCtT6QlVJqb1Zr6AKcmM',   // 礼品使用提醒
  BIND_SUCCESS: 'fnKrftUCVOwXvlo7exFmer78w_R0JfKR3evP5IxxjhE', // 绑定成功提醒
}

/**
 * 请求订阅消息授权
 * @param types 需要订阅的消息类型列表
 */
export async function requestSubscribe(types: (keyof typeof MSG_TEMPLATE_IDS)[]) {
  // 过滤出存在的模板 ID
  const tmplIds = types.map(type => MSG_TEMPLATE_IDS[type]).filter(id => !id.startsWith('PLACEHOLDER'))

  if (tmplIds.length === 0) {
    console.warn('未配置有效的模板 ID，跳过订阅请求')
    return null
  }

  try {
    const res = await Taro.requestSubscribeMessage({
      tmplIds: tmplIds
    })
    console.log('订阅消息结果:', res)
    return res
  } catch (err) {
    console.error('调用订阅消息失败:', err)
    return null
  }
}
