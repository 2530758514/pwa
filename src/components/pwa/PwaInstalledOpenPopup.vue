<script setup>
import { computed } from 'vue'
import { t } from '@/content/pwaText'
import PwaIcon from '@/components/PwaIcon.vue'

defineOptions({
  name: 'PwaInstalledOpenPopup',
})

const visible = defineModel({ type: Boolean, default: false })

const props = defineProps({
  app: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits(['open', 'close'])

const appName = computed(() => props.app?.name || 'App')

function close() {
  visible.value = false
  emit('close')
}

function handleOpen() {
  emit('open')
}
</script>

<template>
  <div v-if="visible" class="pwa-installed-open-popup" role="presentation" @click.stop>
    <section
      class="pwa-installed-open-popup__panel"
      role="dialog"
      aria-modal="true"
      :aria-label="t('pwaPage.installedOpen.title')"
    >
      <button
        type="button"
        class="pwa-installed-open-popup__close"
        :aria-label="t('pwaPage.installedOpen.close')"
        @click="close"
      >
        <PwaIcon name="close" :size="22" />
      </button>

      <img :src="app.logo" :alt="app.name" class="pwa-installed-open-popup__logo" />

      <h2 class="pwa-installed-open-popup__title">{{ t('pwaPage.installedOpen.title') }}</h2>
      <p class="pwa-installed-open-popup__description" dir="auto">
        {{ t('pwaPage.installedOpen.description', { app: appName }) }}
      </p>

      <button type="button" class="pwa-installed-open-popup__primary" @click="handleOpen">
        {{ t('pwaPage.installedOpen.open') }}
      </button>
    </section>
  </div>
</template>

<style scoped>
.pwa-installed-open-popup {
  position: fixed;
  inset: 0;
  z-index: 1000050;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 32px;
  background: rgba(0, 0, 0, 0.55);
}

.pwa-installed-open-popup__panel {
  position: relative;
  width: 100%;
  max-width: 430px;
  border-radius: 10px;
  background: #fff;
  padding: 30px 22px 24px;
  color: #202124;
  text-align: center;
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.32);
}

.pwa-installed-open-popup__close {
  position: absolute;
  top: 10px;
  right: 10px;
  display: flex;
  width: 32px;
  height: 32px;
  align-items: center;
  justify-content: center;
  border: 0;
  background: transparent;
  color: #5f6368;
}

.pwa-installed-open-popup__logo {
  width: 76px;
  height: 76px;
  margin: 0 auto;
  border-radius: 14px;
  object-fit: contain;
  box-shadow: 0 8px 22px rgba(60, 64, 67, 0.18);
}

.pwa-installed-open-popup__title {
  margin: 16px 0 0;
  color: #202124;
  font-size: 20px;
  font-weight: 700;
  line-height: 26px;
}

.pwa-installed-open-popup__description {
  margin: 10px auto 0;
  max-width: 310px;
  color: #5f6368;
  font-size: 14px;
  font-weight: 400;
  line-height: 20px;
}

.pwa-installed-open-popup__primary {
  width: 100%;
  height: 52px;
  border-radius: 5px;
  font-size: 18px;
  line-height: 24px;
}

.pwa-installed-open-popup__primary {
  margin-top: 22px;
  border: 0;
  background: #01875f;
  color: #fff;
  font-weight: 500;
}

</style>
