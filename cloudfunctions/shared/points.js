const { ensure } = require('./validation')

function normalizePoints(value) {
	return Number.isInteger(value) ? value : 0
}

async function changeUserPoints(options) {
	const {
		transaction,
		userId,
		delta,
		insufficientMessage = '积分不足'
	} = options || {}

	ensure(transaction, 'transaction 缺失')
	ensure(userId, '用户不存在')
	ensure(Number.isInteger(delta), '积分变更值不合法')

	const userRes = await transaction.collection('Users').doc(userId).get().catch(() => null)
	const user = userRes && userRes.data ? userRes.data : null
	ensure(user, '用户不存在')

	const currentPoints = normalizePoints(user.totalPoints)
	const nextPoints = currentPoints + delta
	if (nextPoints < 0) {
		throw new Error(insufficientMessage)
	}

	await transaction.collection('Users').doc(userId).update({
		data: {
			totalPoints: nextPoints
		}
	})

	return {
		balanceBefore: currentPoints,
		balanceAfter: nextPoints
	}
}

module.exports = {
	changeUserPoints
}
