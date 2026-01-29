/**
 * 资源处理工具类
 * 为小程序提供高质量的插画、图标和照片支持
 */

// unDraw 默认颜色
const UNDRAW_DEFAULT_COLOR = '#7B61FF'

/**
 * 获取 Iconify 图标 URL
 * @param icon 图标名称 (例如 'mdi:heart')
 * @param color 图标颜色
 */
export const getIconifyUrl = (icon: string, color: string = UNDRAW_DEFAULT_COLOR) => {
  const [prefix, name] = icon.split(':')
  const cleanColor = color.replace('#', '%23')
  return `https://api.iconify.design/${prefix}/${name}.svg?color=${cleanColor}`
}

/**
 * 获取 Pexels 高清照片 URL
 * @param id 照片 ID
 * @param width 宽度
 */
export const getPexelsUrl = (id: string | number, width: number = 400) => {
  return `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=${width}`
}

/**
 * 获取 Picsum 占位图 URL
 * @param width 宽度
 * @param height 高度
 * @param id 选定 ID (可选)
 */
export const getPicsumUrl = (width: number, height: number, id?: number) => {
  return id
    ? `https://picsum.photos/id/${id}/${width}/${height}`
    : `https://picsum.photos/${width}/${height}`
}

/**
 * unDraw 插画配置 (由于小程序不支持直接 SVG 操作，这里提供常用的插画 CDN 映射)
 * 建议在生产环境将 SVG 下载并上传至云存储
 */
export const UNDRAW_ASSETS = {
  MOVIE: 'https://img.js.design/assets/static/7b2e3e9d8f8a4b8a8b8a8f8a4b8a8b8a.png', // 示例：电影院
  CHORE: 'https://img.js.design/assets/static/9c8e7d6f5e4d3c2b1a0f9e8d7c6b5a4.png', // 示例：清洁
  GIFT: 'https://img.js.design/assets/static/1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6.png',  // 示例：礼物
}
