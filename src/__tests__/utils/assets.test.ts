import { getIconifyUrl, getPexelsUrl, getPicsumUrl } from '../../utils/assets'

describe('assets 工具函数', () => {
  describe('getIconifyUrl', () => {
    it('应正确生成带默认颜色的图标链接', () => {
      const url = getIconifyUrl('mdi:heart')
      expect(url).toBe('https://api.iconify.design/mdi/heart.svg?color=%237B61FF')
    })

    it('应正确处理自定义颜色', () => {
      const url = getIconifyUrl('tabler:link', '#FF0000')
      expect(url).toBe('https://api.iconify.design/tabler/link.svg?color=%23FF0000')
    })
  })

  describe('getPexelsUrl', () => {
    it('应使用默认宽度生成链接', () => {
      const url = getPexelsUrl('12345')
      expect(url).toContain('/photos/12345/')
      expect(url).toContain('w=400')
    })

    it('应使用自定义宽度', () => {
      const url = getPexelsUrl(67890, 800)
      expect(url).toContain('w=800')
    })
  })

  describe('getPicsumUrl', () => {
    it('应生成随机占位图链接', () => {
      const url = getPicsumUrl(300, 200)
      expect(url).toBe('https://picsum.photos/300/200')
    })

    it('应支持指定 ID', () => {
      const url = getPicsumUrl(300, 200, 42)
      expect(url).toBe('https://picsum.photos/id/42/300/200')
    })
  })
})
