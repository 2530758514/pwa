<script setup>
import { computed, shallowRef } from 'vue'
import { t } from '@/content/pwaText'
import PwaIcon from '@/components/PwaIcon.vue'

defineOptions({
  name: 'PwaOpenBrowserGuide',
})

const visible = defineModel({ type: Boolean, default: false })

const props = defineProps({
  currentUrl: {
    type: String,
    required: true,
  },
  browserName: {
    type: String,
    default: 'Chrome',
  },
  browserType: {
    type: String,
    default: 'chrome',
    validator: (value) => ['chrome', 'safari'].includes(value),
  },
  openLabel: {
    type: String,
    default: '',
  },
  closable: {
    type: Boolean,
    default: true,
  },
})

const emit = defineEmits(['open-browser'])
const toastText = shallowRef('')
let toastTimer = null

const displayUrl = computed(() => props.currentUrl || '')
const openButtonLabel = computed(() =>
  props.openLabel ||
  t('pwaPage.browserGuide.openBrowser', {
    browser: props.browserName,
  }),
)

function showLocalToast(message) {
  toastText.value = message

  if (toastTimer) window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => {
    toastText.value = ''
    toastTimer = null
  }, 1800)
}

function fallbackCopy(text) {
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', 'readonly')
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  textarea.style.top = '-9999px'
  document.body.appendChild(textarea)
  textarea.focus()
  textarea.select()
  textarea.setSelectionRange(0, textarea.value.length)

  try {
    return document.execCommand('copy')
  } finally {
    document.body.removeChild(textarea)
  }
}

async function writeTextToClipboard(text) {
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // Some in-app browsers expose Clipboard API but block it at runtime.
    }
  }

  return fallbackCopy(text)
}

async function copyCurrentUrl() {
  if (!displayUrl.value) return

  try {
    const copied = await writeTextToClipboard(displayUrl.value)

    if (!copied) throw new Error('Copy command was rejected')

    showLocalToast(t('pwaPage.browserGuide.copySuccess'))
  } catch {
    showLocalToast(t('pwaPage.browserGuide.copyFailed'))
  }
}

function close() {
  if (!props.closable) return

  visible.value = false
}
</script>

<template>
  <div v-if="visible" class="pwa-open-browser-guide" role="presentation" @click.stop>
    <section
      class="pwa-open-browser-guide__panel"
      role="dialog"
      aria-modal="true"
      :aria-label="t('pwaPage.browserGuide.title')"
    >
      <div class="pwa-open-browser-guide__header">
        <h2 class="pwa-open-browser-guide__title">{{ t('pwaPage.browserGuide.title') }}</h2>
        <button
          v-if="closable"
          type="button"
          class="pwa-open-browser-guide__close"
          :aria-label="t('pwaPage.browserGuide.close')"
          @click="close"
        >
          <PwaIcon name="close" :size="22" />
        </button>
      </div>

      <p class="pwa-open-browser-guide__step">
        <span>{{ t('pwaPage.browserGuide.stepOpenPrefix') }}</span>
        <strong>{{ browserName }}</strong>
        <span>{{ t('pwaPage.browserGuide.stepOpenSuffix') }}</span>
      </p>

      <button type="button" class="pwa-open-browser-guide__chrome" @click="emit('open-browser')">
        <span
          class="pwa-open-browser-guide__browser-icon"
          :class="`pwa-open-browser-guide__browser-icon--${browserType}`"
          aria-hidden="true"
        ></span>
        <span>{{ openButtonLabel }}</span>
      </button>

      <p class="pwa-open-browser-guide__step pwa-open-browser-guide__step--copy">
        <span>{{ t('pwaPage.browserGuide.stepCopyPrefix') }}</span>
        <strong>{{ browserName }}</strong>
        <span>{{ t('pwaPage.browserGuide.stepCopySuffix') }}</span>
      </p>

      <input
        class="pwa-open-browser-guide__url"
        data-pwa-browser-guide-copy-action
        type="text"
        :value="displayUrl"
        readonly
        aria-readonly="true"
      />

      <button
        type="button"
        class="pwa-open-browser-guide__copy"
        data-pwa-browser-guide-copy-action
        @click="copyCurrentUrl"
      >
        {{ t('pwaPage.browserGuide.copy') }}
      </button>
    </section>

    <div v-if="toastText" class="pwa-open-browser-guide__toast">{{ toastText }}</div>
  </div>
</template>

<style scoped>
.pwa-open-browser-guide {
  position: fixed;
  inset: 0;
  z-index: 1000040;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 32px;
  background: rgba(0, 0, 0, 0.55);
}

.pwa-open-browser-guide__panel {
  width: 100%;
  max-width: 430px;
  border-radius: 10px;
  background: #fff;
  padding: 22px 22px 28px;
  color: #111;
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.32);
}

.pwa-open-browser-guide__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.pwa-open-browser-guide__title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  line-height: 24px;
}

.pwa-open-browser-guide__close {
  display: flex;
  height: 32px;
  width: 32px;
  align-items: center;
  justify-content: center;
  border: 0;
  background: transparent;
  color: #5f6368;
}

.pwa-open-browser-guide__step {
  margin: 0;
  color: #111;
  font-size: 16px;
  font-weight: 400;
  line-height: 22px;
}

.pwa-open-browser-guide__step strong {
  font-weight: 700;
}

.pwa-open-browser-guide__chrome {
  display: flex;
  width: 100%;
  height: 52px;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-top: 18px;
  border: 0;
  border-radius: 5px;
  background: #01875f;
  color: #fff;
  font-size: 18px;
  font-weight: 500;
  line-height: 24px;
}

.pwa-open-browser-guide__browser-icon {
  position: relative;
  width: 22px;
  height: 22px;
  flex: 0 0 auto;
}

.pwa-open-browser-guide__browser-icon--chrome {
  border-radius: 999px;
  background: conic-gradient(#fbbc05 0 33%, #34a853 0 66%, #ea4335 0 100%);
}

.pwa-open-browser-guide__browser-icon--chrome::before {
  content: '';
  position: absolute;
  inset: 5px;
  border-radius: 999px;
  background: #4285f4;
  box-shadow: inset 0 0 0 2px rgba(255, 255, 255, 0.72);
}

.pwa-open-browser-guide__browser-icon--safari {
  border-radius: 999px;
  background:
    linear-gradient(45deg, transparent 45%, #fff 45% 55%, transparent 55%),
    radial-gradient(circle at 50% 50%, #27a7ff 0 58%, #0b74d1 59% 100%);
  box-shadow: inset 0 0 0 2px rgba(255, 255, 255, 0.85);
}

.pwa-open-browser-guide__browser-icon--safari::before {
  content: '';
  position: absolute;
  left: 50%;
  top: 3px;
  width: 3px;
  height: 16px;
  border-radius: 999px;
  background: #f44336;
  transform: translateX(-50%) rotate(35deg);
  transform-origin: center;
}

.pwa-open-browser-guide__step--copy {
  margin-top: 18px;
}

.pwa-open-browser-guide__url {
  width: 100%;
  height: 48px;
  margin-top: 18px;
  border: 1px solid #d7dde3;
  border-radius: 5px;
  padding: 0 12px;
  color: #8a8f94;
  font-size: 16px;
  font-weight: 400;
  line-height: 24px;
  outline: none;
}

.pwa-open-browser-guide__copy {
  width: 100%;
  height: 52px;
  margin-top: 16px;
  border: 1px solid #01875f;
  border-radius: 5px;
  background: #fff;
  color: #01875f;
  font-size: 18px;
  font-weight: 400;
  line-height: 24px;
}

.pwa-open-browser-guide__toast {
  position: fixed;
  bottom: 84px;
  left: 50%;
  z-index: 1000041;
  max-width: 320px;
  transform: translateX(-50%);
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.78);
  padding: 10px 16px;
  color: #fff;
  font-size: 14px;
}
</style>
