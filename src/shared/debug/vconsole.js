import VConsole from 'vconsole'

const VCONSOLE_LAYER_STYLE_ID = 'vconsole-debug-layer-style'
let vConsoleInstance = null

function ensureVConsoleTopLayer() {
  if (document.getElementById(VCONSOLE_LAYER_STYLE_ID)) return

  const style = document.createElement('style')
  style.id = VCONSOLE_LAYER_STYLE_ID
  style.textContent = `
    #__vconsole {
      position: relative !important;
      z-index: 2147483647 !important;
    }

    #__vconsole .vc-switch,
    #__vconsole .vc-mask,
    #__vconsole .vc-panel {
      z-index: 2147483647 !important;
    }
  `
  document.head.appendChild(style)
}

export function initVConsole() {
  if (vConsoleInstance) return vConsoleInstance

  vConsoleInstance = new VConsole({
    theme: 'dark',
  })
  ensureVConsoleTopLayer()

  return vConsoleInstance
}
