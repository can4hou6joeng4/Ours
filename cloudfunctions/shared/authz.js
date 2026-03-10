const { ensure, normalizeString } = require('./validation')

function assertBoundPartner(user, openid) {
	const partnerId = normalizeString(user && user.partnerId)
	ensure(partnerId, '请先绑定伙伴')
	ensure(partnerId !== openid, '伙伴信息异常，请重新绑定')
	return partnerId
}

function canAccessGift(gift, openid) {
	if (!gift) return false
	return gift.creatorId === openid || gift.partnerId === openid
}

function assertGiftAccessible(gift, openid) {
	ensure(gift, '礼品不存在')
	ensure(canAccessGift(gift, openid), '无权兑换该礼品')
}

function assertItemOwner(item, openid) {
	ensure(item && item.userId === openid, '物品不存在或无权操作')
}

function getTaskExecutorId(task) {
	return (task && (task.executorId || task.targetId)) || ''
}

function assertTaskCreator(task, openid, message = '只有任务发布者可以确认完成') {
	ensure(task && task.creatorId === openid, message)
}

function assertTaskExecutor(task, openid, message = '只有任务执行者可以提交完成') {
	const executorId = getTaskExecutorId(task)
	ensure(executorId === openid, message)
	return executorId
}

function getAllowedUserIds(user, openid) {
	const ids = [openid]
	const partnerId = normalizeString(user && user.partnerId)
	if (partnerId && partnerId !== openid) {
		ids.push(partnerId)
	}
	return ids
}

function resolveAccessibleUserId(user, openid, targetUserId, message = '无权访问该用户数据') {
	const normalizedTargetId = normalizeString(targetUserId)
	if (!normalizedTargetId || normalizedTargetId === openid) {
		return openid
	}

	const partnerId = normalizeString(user && user.partnerId)
	ensure(partnerId, message)
	ensure(partnerId === normalizedTargetId, message)
	return normalizedTargetId
}

module.exports = {
	assertBoundPartner,
	canAccessGift,
	assertGiftAccessible,
	assertItemOwner,
	getTaskExecutorId,
	assertTaskCreator,
	assertTaskExecutor,
	getAllowedUserIds,
	resolveAccessibleUserId
}
