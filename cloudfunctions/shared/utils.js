/**
 * 安全截断文本
 * @param {string} text - 原始文本
 * @param {number} maxLength - 最大长度
 * @returns {string} 截断后的文本
 */
function safeTruncate(text, maxLength) {
  if (!text) return ''
  const strText = String(text)
  const truncated = strText.substring(0, maxLength)
  return truncated + (strText.length > maxLength ? '...' : '')
}

module.exports = { safeTruncate }
