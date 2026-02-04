/**
 * 本地 Base64 图标
 * 避免 TabBar 每次渲染都请求远程 Iconify API
 */

// Tabler Icons - Base64 编码的 SVG
const createSvgDataUrl = (svg: string, color: string) => {
  const coloredSvg = svg.replace(/currentColor/g, color)
  return `data:image/svg+xml;base64,${btoa(coloredSvg)}`
}

// 原始 SVG 模板 (stroke-based icons from Tabler)
const ICON_SVGS = {
  home: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l-2 0l9 -9l9 9l-2 0"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-7"/><path d="M9 21v-6a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v6"/></svg>`,

  refresh: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4"/><path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4"/></svg>`,

  package: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 4.5l0 9l-8 4.5l-8 -4.5l0 -9l8 -4.5"/><path d="M12 12l8 -4.5"/><path d="M12 12l0 9"/><path d="M12 12l-8 -4.5"/></svg>`,

  user: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0"/><path d="M6 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2"/></svg>`,
}

// 预生成的图标缓存
const iconCache: Record<string, Record<string, string>> = {}

/**
 * 获取本地图标 (高性能)
 * @param iconName 图标名称: 'home' | 'refresh' | 'package' | 'user'
 * @param color 颜色值
 */
export const getLocalIcon = (iconName: keyof typeof ICON_SVGS, color: string): string => {
  // 缓存键
  const cacheKey = `${iconName}_${color}`

  if (!iconCache[cacheKey]) {
    const svg = ICON_SVGS[iconName]
    if (svg) {
      iconCache[cacheKey] = { url: createSvgDataUrl(svg, color) }
    }
  }

  return iconCache[cacheKey]?.url || ''
}

// TabBar 专用：预定义颜色
export const TAB_ICONS = {
  home: {
    active: createSvgDataUrl(ICON_SVGS.home, '#D4B185'),
    inactive: createSvgDataUrl(ICON_SVGS.home, '#888888'),
  },
  refresh: {
    active: createSvgDataUrl(ICON_SVGS.refresh, '#D4B185'),
    inactive: createSvgDataUrl(ICON_SVGS.refresh, '#888888'),
  },
  package: {
    active: createSvgDataUrl(ICON_SVGS.package, '#D4B185'),
    inactive: createSvgDataUrl(ICON_SVGS.package, '#888888'),
  },
  user: {
    active: createSvgDataUrl(ICON_SVGS.user, '#D4B185'),
    inactive: createSvgDataUrl(ICON_SVGS.user, '#888888'),
  },
}
