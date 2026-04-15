/// <reference types="@tarojs/taro" />

declare module '*.scss' {
  const content: Record<string, string>
  export default content
}

/** Taro defineConstants 编译时注入 */
declare const CLOUD_ENV_ID: string
