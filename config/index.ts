const path = require('path')
const fs = require('fs')

// 读取 .env.local 环境变量
function loadEnvLocal() {
  const envPath = path.resolve(__dirname, '..', '.env.local')
  const env: Record<string, string> = {}
  try {
    const content = fs.readFileSync(envPath, 'utf-8')
    content.split('\n').forEach((line: string) => {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) return
      const [key, ...rest] = trimmed.split('=')
      env[key.trim()] = rest.join('=').trim()
    })
  } catch (_) {
    console.warn('未找到 .env.local，使用默认空值')
  }
  return env
}

const envLocal = loadEnvLocal()

const config = {
  projectName: 'OursApp',
  date: '2026-01-28',
  designWidth: 750,
  deviceRatio: {
    640: 2.34 / 2,
    750: 1,
    828: 1.81 / 2
  },
  sourceRoot: 'src',
  outputRoot: 'dist',
  plugins: [],
  defineConstants: {
    CLOUD_ENV_ID: JSON.stringify(envLocal.CLOUD_ENV_ID || ''),
  },
  copy: {
    patterns: [],
    options: {}
  },
  framework: 'react',
  compiler: {
    type: 'webpack5',
    prebundle: {
      enable: true,
      exclude: ['dayjs', 'dayjs/plugin/relativeTime']
    }
  },
  cache: {
    enable: true
  },
  mini: {
    miniCssExtractPluginOption: {
      ignoreOrder: true  // 忽略 CSS 模块顺序警告
    },
    postcss: {
      pxtransform: {
        enable: true,
        config: {}
      },
      url: {
        enable: true,
        config: {
          limit: 1024
        }
      },
      cssModules: {
        enable: false,
        config: {
          namingPattern: 'module',
          generateScopedName: '[name]__[local]___[hash:base64:5]'
        }
      }
    }
  },
  h5: {
    publicPath: '/',
    staticDirectory: 'static',
    postcss: {
      autoprefixer: {
        enable: true,
        config: {}
      },
      cssModules: {
        enable: false,
        config: {
          namingPattern: 'module',
          generateScopedName: '[name]__[local]___[hash:base64:5]'
        }
      }
    }
  }
}

module.exports = function (merge) {
  if (process.env.NODE_ENV === 'development') {
    return merge({}, config, require('./dev'))
  }
  return merge({}, config, require('./prod'))
}
