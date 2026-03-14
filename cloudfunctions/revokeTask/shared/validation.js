function normalizeString(value) {
  if (value === undefined || value === null) return ''
  return String(value).trim()
}

function ensure(condition, message) {
  if (!condition) throw new Error(message)
}

function ensureEnum(value, allowedValues, message) {
  ensure(Array.isArray(allowedValues) && allowedValues.length > 0, '枚举配置不合法')
  ensure(allowedValues.includes(value), message)
  return value
}

function parsePositiveInteger(value, options = {}) {
  const { invalidMessage = '参数必须是正整数', max = null, maxMessage = `参数不能超过 ${max}` } = options
  const normalized = normalizeString(value)
  const parsed = Number(normalized)
  if (!/^\d+$/.test(normalized) || !Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(invalidMessage)
  }
  if (max !== null && parsed > max) throw new Error(maxMessage)
  return parsed
}

function normalizeOptionalRequestId(value) {
  const requestId = normalizeString(value)
  if (!requestId) return ''
  ensure(requestId.length <= 64, 'requestId 长度不能超过 64')
  return requestId
}


function normalizeLimitedString(value, { fieldName = '字段', maxLength = 200, allowEmpty = false } = {}) {
  const str = normalizeString(value)
  if (!str) {
    if (!allowEmpty) throw new Error(`${fieldName}不能为空`)
    return ''
  }
  if (str.length > maxLength) throw new Error(`${fieldName}不能超过 ${maxLength} 字`)
  return str
}
module.exports = {
  normalizeString,
  ensure,
  ensureEnum,
  parsePositiveInteger,
  normalizeOptionalRequestId,
  normalizeLimitedString
}
