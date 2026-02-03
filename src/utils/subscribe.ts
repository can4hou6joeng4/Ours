import Taro from '@tarojs/taro'

// 订阅消息模板 ID 常量
 export const MSG_TEMPLATE_IDS = {
   NEW_TASK: 'BDmFGTb7vGdwB_BX1k6DGrqfRt2yl_dReh_ar3g8CN0',     // 新任务提醒
   TASK_DONE: 'BDmFGTb7vGdwB_BX1k6DGlsnq1YEpEDEy8n2y8g41_E',   // 任务完成提醒
   GIFT_USED: 'bxIAEflde73fD0hcYRnE6LkOCtT6QlVJqb1Zr6AKcmM',   // 礼品使用提醒
   BIND_SUCCESS: 'fnKrftUCVOwXvlo7exFmer78w_R0JfKR3evP5IxxjhE', // 绑定成功提醒
 }

/**
 * 检查订阅状态
 * @param templateId 模板 ID
 */
 export async function checkSubscription(templateId: string) {
   try {
     const setting = await Taro.getSetting()
     const status = setting.subscriptionsSetting?.[templateId]
     return status !== 'reject'
   } catch (err) {
     console.error('检查订阅状态失败', err)
     return true // 默认允许发送
   }
 }

/**
 * 请求订阅消息授权（带错误处理和用户引导）
 * @param types 需要订阅的消息类型列表
 */
 export async function requestSubscribe(types: (keyof typeof MSG_TEMPLATE_IDS)[]) {
   // 过滤出存在的模板 ID
   const tmplIds = types.map(type => MSG_TEMPLATE_IDS[type])

   if (tmplIds.length === 0) {
     console.warn('未配置有效的模板 ID，跳过订阅请求')
     return null
   }

   try {
     const res = await Taro.requestSubscribeMessage({
       tmplIds
     })
     console.log('订阅消息结果:', res)
     return res
   } catch (err: any) {
     console.error('调用订阅消息失败:', err)

     // 用户拒收时，引导用户去设置
     if (err.errMsg?.includes('requestSubscribeMessage:fail cancel')) {
       Taro.showModal({
         title: '订阅提示',
         content: '您已拒绝订阅消息，如需接收提醒，请在设置中开启',
         confirmText: '去设置',
         cancelText: '取消',
         success: (res) => {
           if (res.confirm) {
             Taro.openSetting()
           }
         }
       })
     }

     return null
   }
 }
