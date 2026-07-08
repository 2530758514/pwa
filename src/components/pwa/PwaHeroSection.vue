<script setup>
import { computed } from 'vue'
import { PWA_SOURCE_ASSETS } from '@/content/pwaPageContent'
import { t } from '@/content/pwaText'
import PwaIcon from '@/components/PwaIcon.vue'
import PwaInstallButton from './PwaInstallButton.vue'

defineOptions({
  name: 'PwaHeroSection',
})

const props = defineProps({
  app: {
    type: Object,
    required: true,
  },
  metrics: {
    type: Array,
    required: true,
  },
  installLabel: {
    type: String,
    required: true,
  },
  installSubtitle: {
    type: String,
    default: '',
  },
  installLoading: {
    type: Boolean,
    default: false,
  },
  installDisabled: {
    type: Boolean,
    default: false,
  },
  installVisualActive: {
    type: Boolean,
    default: false,
  },
  installProgressText: {
    type: String,
    default: '',
  },
  showQrCode: {
    type: Boolean,
    default: false,
  },
  qrCodeSrc: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['install'])

const metricItems = computed(() =>
  props.metrics.map((item) => ({
    ...item,
    label: item.labelKey ? t(item.labelKey) : item.label,
    value: item.valueKey ? props.app[item.valueKey] || '' : item.value,
    subValue: item.subValueKey ? String(props.app[item.subValueKey] ?? '') : item.subValue,
  })),
)
</script>

<template>
  <section class="px-[22px] pb-0 pt-[65px]">
    <div class="flex items-start gap-[25px]">
      <div
        class="pwa-hero-section__logo-wrap"
        :class="{ 'pwa-hero-section__logo-wrap--installing': installVisualActive }"
      >
        <img
          v-if="app.logo"
          :src="app.logo"
          :alt="app.name"
          class="pwa-hero-section__logo h-[74px] w-[74px] shrink-0 rounded-[12px] object-contain"
        />
        <div
          v-else
          class="pwa-hero-section__logo pwa-hero-section__logo-placeholder h-[74px] w-[74px] shrink-0 rounded-[12px]"
          aria-hidden="true"
        ></div>
      </div>
      <div class="min-w-0 flex-1 pt-1">
        <h1 class="flex items-center gap-1 break-words text-[24px] font-medium leading-[32px] text-[#202124]">
          {{ app.name }}
          <img :src="PWA_SOURCE_ASSETS.verifiedIcon" alt="" class="h-[19px] w-[19px] shrink-0" />
        </h1>
        <p
          v-if="installVisualActive && installProgressText"
          class="mt-0.5 break-words text-[16px] font-normal leading-[24px] text-[#5f6368]"
        >
          {{ installProgressText }}
        </p>
        <p
          v-if="app.publisher"
          class="mt-0.5 break-words text-[16px] font-medium leading-[24px] text-[#00875f]"
        >
          {{ app.publisher }}
        </p>
        <p class="mt-1 flex items-center gap-1 text-[12px] font-normal leading-[16px] text-[#5f6368]">
          <img :src="PWA_SOURCE_ASSETS.shieldIcon" alt="" class="h-[14px] w-3 shrink-0" />
          <span>{{ t('pwaPage.hero.verified') }}</span>
        </p>
      </div>
    </div>

    <div class="mt-[36px] grid grid-cols-3 text-center">
      <div
        v-for="(item, index) in metricItems"
        :key="item.label"
        class="relative flex min-h-[54px] flex-col items-center justify-center px-2"
        :class="
          index > 0
            ? 'before:absolute before:left-0 before:top-1/2 before:h-[38px] before:w-px before:-translate-y-1/2 before:bg-[#e0e2e6]'
            : ''
        "
      >
        <div class="flex h-6 items-center justify-center text-[14px] font-medium leading-5 text-[#202124]">
          <template v-if="item.icon === 'featured'">
            <img :src="item.image" alt="" class="h-[22px] w-[22px] object-contain" />
          </template>
          <template v-else>
            <span>{{ item.value }}</span>
            <span v-if="item.icon === 'star'" class="ml-0.5">&#9733;</span>
          </template>
        </div>
        <div class="mt-1 whitespace-nowrap text-[10px] font-normal leading-[14px] text-[#5f6368]">
          <span v-if="item.subValue" class="mr-1">{{ item.subValue }}</span>
          {{ item.label }}
        </div>
      </div>
    </div>

    <div v-if="showQrCode && qrCodeSrc" class="mt-7 flex min-h-[304px] items-center justify-between gap-4">
      <div class="relative w-[46%] max-w-[210px] shrink-0">
        <img :src="PWA_SOURCE_ASSETS.scanPhone" alt="" class="w-full object-contain" />
        <img
          :src="PWA_SOURCE_ASSETS.scanLine"
          alt=""
          class="absolute left-1/2 top-[40%] w-[46%] -translate-x-1/2 object-contain"
        />
      </div>

      <div class="min-w-0 flex-1">
        <div class="relative mx-auto aspect-square w-full max-w-[214px] p-6">
          <img
            v-for="corner in 4"
            :key="corner"
            :src="PWA_SOURCE_ASSETS.scanAngle"
            alt=""
            class="absolute h-9 w-9"
            :class="[
              corner === 1 ? 'left-0 top-0' : '',
              corner === 2 ? 'right-0 top-0 rotate-90' : '',
              corner === 3 ? 'bottom-0 right-0 rotate-180' : '',
              corner === 4 ? 'bottom-0 left-0 -rotate-90' : '',
            ]"
          />
          <img :src="qrCodeSrc" alt="" class="h-full w-full object-contain" />
        </div>
        <div class="mt-2 text-right text-[16px] leading-6 text-[#2e3135]">
          {{ t('pwaPage.hero.scanQr') }}
        </div>
      </div>
    </div>

    <PwaInstallButton
      :label="installLabel"
      :subtitle="installSubtitle"
      :disabled="installDisabled"
      :loading="installLoading"
      @install="emit('install')"
    />

    <div class="mt-[5px] flex items-center justify-between px-[8px] text-[14px] font-normal text-[#00875f]">
      <button type="button" class="flex min-h-[44px] items-center gap-3 active:opacity-70">
        <PwaIcon name="share" :size="25" />
        <span>{{ t('pwaPage.actions.share') }}</span>
      </button>
      <button type="button" class="flex min-h-[44px] items-center gap-3 active:opacity-70">
        <PwaIcon name="bookmark" :size="24" />
        <span>{{ t('pwaPage.actions.wishlist') }}</span>
      </button>
    </div>
  </section>
</template>

<style scoped>
.pwa-hero-section__logo-wrap {
  position: relative;
  width: 74px;
  height: 74px;
  flex: 0 0 auto;
}

.pwa-hero-section__logo-wrap--installing {
  width: 74px;
  height: 74px;
  margin: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.pwa-hero-section__logo-wrap--installing::before {
  content: '';
  position: absolute;
  inset: 5px;
  border-radius: 999px;
  border: 2px solid rgba(1, 135, 95, 0.18);
  border-top-color: #01875f;
  border-right-color: #01875f;
  animation: pwaHeroLogoRingSpin 1.1s linear infinite;
}

.pwa-hero-section__logo-wrap--installing .pwa-hero-section__logo {
  width: 46px;
  height: 46px;
  border-radius: 8px;
}

.pwa-hero-section__logo-placeholder {
  background: #edf1f3;
}

@keyframes pwaHeroLogoRingSpin {
  to {
    transform: rotate(360deg);
  }
}
</style>
