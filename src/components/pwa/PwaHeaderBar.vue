<script setup>
import { PWA_SOURCE_ASSETS } from '@/content/pwaPageContent'

defineOptions({
  name: 'PwaHeaderBar',
})

defineProps({
  showGoogleIcon: {
    type: Boolean,
    default: true,
  },
  showOfficialCertification: {
    type: Boolean,
    default: true,
  },
})
</script>

<template>
  <header class="app-fixed-viewport fixed top-0 z-20 flex h-[64px] items-center bg-white pt-[5px] pr-[5px] pb-[10px] pl-[20px]">
    <div class="flex min-w-0 items-center gap-2.5">
      <img
        v-if="showGoogleIcon"
        :src="PWA_SOURCE_ASSETS.googlePlayLogo"
        alt=""
        class="h-[42px] w-[42px] shrink-0 object-contain"
      />
      <span class="pwa-header-bar__brand truncate">Google Play</span>
    </div>

    <img
      v-if="showOfficialCertification"
      :src="PWA_SOURCE_ASSETS.topDeveloper"
      alt="Top Developer"
      class="ml-auto h-[52px] w-[154px] shrink-0 object-contain"
    />
  </header>
</template>

<style scoped>
.pwa-header-bar__brand {
  display: flex;
  z-index: 1;
  height: 100%;
  align-items: center;
  margin: 0 8px;
  color: #5f6368;
  font-family: 'Google Sans', Roboto, Arial, sans-serif;
  font-size: 23px;
  font-weight: 500;
  line-height: 28px;
  letter-spacing: 0;
  white-space: nowrap;
}
</style>
