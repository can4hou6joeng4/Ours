const cloud = require('wx-server-sdk')
const { normalizeString, normalizeOptionalRequestId } = require('./shared/validation')
const { runWithIdempotencyTransaction } = require('./shared/idempotency')
const { changeUserPoints } = require('./shared/points')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

function fail(message) {
	return { success: false, message }
}

exports.main = async (event, context) => {
	const { OPENID } = cloud.getWXContext()
	const taskId = normalizeString(event && event.taskId)
	let requestId = ''

	try {
		if (!taskId) return fail('任务 ID 不能为空')
		requestId = normalizeOptionalRequestId(event && event.requestId)
	} catch (validationError) {
		return fail(validationError.message)
	}

	try {
		const txResult = await runWithIdempotencyTransaction({
			db,
			openid: OPENID,
			scope: 'revokeTask',
			requestId,
			work: async transaction => {
				const taskRes = await transaction.collection('Tasks').doc(taskId).get()
				const task = taskRes && taskRes.data ? taskRes.data : null

				if (!task) throw new Error('任务不存在')
				if (task.creatorId !== OPENID) throw new Error('无权撤销该任务')
				if (task.status === 'revoked') throw new Error('任务已撤销')

				const { type, status, points, targetId, title } = task

				let pointsMutation = null

				if (type === 'reward') {
					if (status === 'done') {
						// 奖赏已完成：扣回积分并记录流水
						pointsMutation = await changeUserPoints({
							transaction,
							userId: targetId,
							delta: -points,
							insufficientMessage: '对方积分不足，无法撤销'
						})

						await transaction.collection('Records').add({
							data: {
								userId: targetId,
								type: 'revoke',
								amount: -points,
								balanceAfter: pointsMutation.balanceAfter,
								reason: `[撤销奖赏] ${title}`,
								createTime: db.serverDate()
							}
						})
					} else if (status === 'waiting_confirmation' || status === 'pending') {
						// 奖赏待完成或待验收：无积分变动，直接撤销
					} else {
						throw new Error('任务状态异常，无法撤销')
					}
				} else if (type === 'penalty') {
					// 惩罚任务：撤销时退回已扣除的积分
					pointsMutation = await changeUserPoints({
						transaction,
						userId: targetId,
						delta: points,
						insufficientMessage: '积分异常'
					})

					await transaction.collection('Records').add({
						data: {
							userId: targetId,
							type: 'revoke',
							amount: points,
							balanceAfter: pointsMutation.balanceAfter,
							reason: `[撤销惩罚] ${title}`,
							createTime: db.serverDate()
						}
					})
				} else {
					throw new Error('任务类型异常，无法撤销')
				}

				await transaction.collection('Tasks').doc(taskId).update({
					data: {
						status: 'revoked',
						revokeTime: db.serverDate()
					}
				})

				const response = { success: true, message: '撤销成功' }
				if (pointsMutation) response.balanceAfter = pointsMutation.balanceAfter
				if (requestId) response.requestId = requestId
				return response
			}
		})

		const { __idempotencyReplay, ...result } = txResult || {}
		return result
	} catch (e) {
		console.error('撤销任务失败', e)
		return fail(e.message || '操作失败，请重试')
	}
}
