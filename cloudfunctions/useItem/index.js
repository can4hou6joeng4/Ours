const cloud = require('wx-server-sdk')
const dayjs = require('dayjs')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

function safeTruncate(text, maxLength) {
  if (!text) return ''
  const truncated = text.toString().substring(0, maxLength)
  return truncated + (text.toString().length > maxLength ? '...' : '')
}

exports.main = async (event, context) => {
	const { OPENID } = cloud.getWXContext()
	const normalizedItemId = String(event?.itemId || '').trim()

	if (!normalizedItemId) {
		return { success: false, error: '缺少物品ID' }
	}

	try {
		return await db.runTransaction(async transaction => {
			const itemRes = await transaction.collection('Items').doc(normalizedItemId).get()

			if (!itemRes.data || itemRes.data.userId !== OPENID) {
				throw new Error('物品不存在或无权操作')
			}

			if (itemRes.data.status === 'used') {
				throw new Error('该物品已使用过了')
			}

			const sourceGiftId = String(itemRes.data.sourceGiftId || '').trim()

			// 1. 更新状态为已使用
			await transaction.collection('Items').doc(normalizedItemId).update({
				data: {
					status: 'used',
					useTime: db.serverDate()
				}
			})

			// 2. 写入交互流水：itemId 永远指向 Items._id；giftId/sourceGiftId 指向 Gifts._id
			await transaction.collection('Records').add({
				data: {
					userId: OPENID,
					type: 'gift_use',
					amount: 0,
					reason: `[兑换请求] ${itemRes.data.name}`,
					itemId: normalizedItemId,
					giftId: sourceGiftId || null,
					sourceGiftId: sourceGiftId || null,
					createTime: db.serverDate()
				}
			})

			// 3. 写入正式通知，用于首页仪式感弹窗
			const userRes = await transaction.collection('Users').doc(OPENID).get()
			if (userRes.data && userRes.data.partnerId) {
				await transaction.collection('Notices').add({
					data: {
						itemId: normalizedItemId,
						giftId: sourceGiftId || null,
						sourceGiftId: sourceGiftId || null,
						type: 'GIFT_USED',
						title: '💝 收到使用请求',
						message: `对方想要使用：${itemRes.data.name}`,
						points: 0,
						senderId: OPENID,
						receiverId: userRes.data.partnerId,
						read: false,
						createTime: db.serverDate()
					}
				})

				// 4. 发送订阅消息给对方
				try {
					const itemName = safeTruncate(itemRes.data.name, 20)
					const nickName = safeTruncate(userRes.data.nickName, 10)

					await cloud.openapi.subscribeMessage.send({
						touser: userRes.data.partnerId,
						templateId: 'bxIAEflde73fD0hcYRnE6LkOCtT6QlVJqb1Zr6AKcmM',
						page: 'pages/inventory/index',
						data: {
							thing31: { value: itemName },
							thing24: { value: nickName || '对方' },
							time3: { value: dayjs().format('YYYY年MM月DD日 HH:mm') }
						}
					})
				} catch (sendError) {
					console.warn('礼品使用订阅消息发送失败', sendError)
				}
			}

			return { success: true }
		})
	} catch (e) {
		return { success: false, error: e.message }
	}
}
