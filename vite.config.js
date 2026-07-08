import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import postcssPxToViewport from 'postcss-px-to-viewport-8-plugin'
import { fileURLToPath, URL } from 'node:url'

const APP_DESIGN_WIDTH = 375
const APP_MAX_WIDTH = 430
const UNCAPPED_VIEWPORT_SELECTORS = ['.pwa-iframe-shell', '.pwa-iframe-shell__frame']

function formatNumber(value) {
  return String(Number(value.toFixed(6)))
}

function capViewportUnitValue(value) {
  return value.replace(/(-?\d*\.?\d+)vw\b/g, (match, rawValue) => {
    const vwValue = Number(rawValue)

    if (!Number.isFinite(vwValue) || vwValue === 0) return match

    const cappedPx = formatNumber((Math.abs(vwValue) / 100) * APP_MAX_WIDTH)
    const viewportValue = `${formatNumber(vwValue)}vw`

    if (vwValue < 0) {
      return `max(${viewportValue}, -${cappedPx}px)`
    }

    return `min(${viewportValue}, ${cappedPx}px)`
  })
}

function capViewportUnits() {
  return {
    postcssPlugin: 'pwa-cap-viewport-units',
    Declaration(decl) {
      if (!decl.value.includes('vw') || decl.prop.startsWith('--')) return
      if (/\b(?:min|max|clamp)\(/.test(decl.value)) return

      const sourceFile = decl.source?.input?.file || ''
      if (sourceFile.includes('node_modules')) return

      const selector = decl.parent?.selector || ''
      if (UNCAPPED_VIEWPORT_SELECTORS.some((item) => selector.includes(item))) return

      decl.value = capViewportUnitValue(decl.value)
    },
  }
}

function restoreFullBorderRadius() {
  return {
    postcssPlugin: 'pwa-restore-full-border-radius',
    Declaration(decl) {
      if (!decl.prop.includes('border') || !decl.prop.includes('radius')) return
      if (!decl.value.includes('3.40282e')) return

      decl.value = '9999px'
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const proxyPrefix = env.VITE_PROXY_PREFIX || '/api'
  const proxyTarget = env.VITE_PROXY_TARGET || 'http://localhost:3000'
  const proxyRewritePrefix = env.VITE_PROXY_REWRITE_PREFIX || ''
  const stripProxyPrefix = env.VITE_PROXY_STRIP_PREFIX === 'true'

  return {
    plugins: [vue(), tailwindcss()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 4010,
      proxy: {
        [proxyPrefix]: {
          target: proxyTarget,
          changeOrigin: true,
          rewrite:
            stripProxyPrefix || proxyRewritePrefix
              ? (requestPath) => requestPath.replace(new RegExp(`^${proxyPrefix}`), proxyRewritePrefix)
              : undefined,
        },
      },
    },
    css: {
      postcss: {
        plugins: [
          postcssPxToViewport({
            viewportWidth: APP_DESIGN_WIDTH,
            viewportHeight: 812,
            unitPrecision: 6,
            viewportUnit: 'vw',
            selectorBlackList: ['.ignore', '.hairlines', '.max-w-', '.min-w-'],
            minPixelValue: 1,
            mediaQuery: true,
            replace: true,
            exclude: [/node_modules/, /\.html$/],
            include: [/src/],
            landscape: false,
            propList: ['*', '!--*'],
          }),
          restoreFullBorderRadius(),
          capViewportUnits(),
        ],
      },
    },
  }
})
