<script setup>
import { computed } from 'vue'
import { t } from '@/content/pwaText'

defineOptions({
  name: 'PwaBottomNav',
})

const props = defineProps({
  links: {
    type: Array,
    default: () => [],
  },
  familyLinks: {
    type: Array,
    default: () => [],
  },
  activeKey: {
    type: String,
    default: 'games',
  },
})

const navItems = [
  {
    key: 'games',
    labelKey: 'pwaPage.nav.games',
    viewBox: '0 0 24 24',
    path: 'M5 7a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4l1 7.5A3 3 0 0 1 15 17l-2-2h-2l-2 2a3 3 0 0 1-5-2.5L5 7Zm4 1H7v2H5v2h2v2h2v-2h2v-2H9V8Zm7 .5a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5Zm2.25 3a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5Z',
  },
  {
    key: 'apps',
    labelKey: 'pwaPage.nav.apps',
    viewBox: '0 0 24 24',
    path: 'M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 0h7v7h-7v-7Z',
  },
  {
    key: 'films',
    labelKey: 'pwaPage.nav.films',
    viewBox: '0 0 24 24',
    path: 'M4 3h16v18H4V3Zm3 2H5v3h2V5Zm0 5H5v3h2v-3Zm0 5H5v4h2v-4Zm12-10h-2v3h2V5Zm0 5h-2v3h2v-3Zm0 5h-2v4h2v-4ZM9 5v14h6V5H9Z',
  },
  {
    key: 'books',
    labelKey: 'pwaPage.nav.books',
    viewBox: '0 0 24 24',
    path: 'M5 3h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5V3Zm2 2v14h10V5h-2v7l-3-2-3 2V5H7Z',
  },
  {
    key: 'children',
    labelKey: 'pwaPage.nav.children',
    viewBox: '0 0 24 24',
    path: 'M12 3 14.7 8l5.3.8-3.8 3.7.9 5.3L12 15.3 6.9 17.8l.9-5.3L4 8.8 9.3 8 12 3Z',
  },
]

const activeNavKey = computed(() => {
  const key = String(props.activeKey || '').trim()

  return navItems.some((item) => item.key === key) ? key : 'games'
})
</script>

<template>
  <footer class="mt-9 border-t border-[#e8eaed] px-[27px] pb-28 pt-10 text-[#4c5667]">
    <div class="space-y-2">
      <button
        v-for="link in props.links"
        :key="link"
        class="pwa-bottom-nav__footer-link block min-h-8 text-left leading-8"
        type="button"
      >
        {{ t(link) }}
      </button>
    </div>

    <div class="mt-10 space-y-2">
      <button
        v-for="link in props.familyLinks"
        :key="link"
        class="pwa-bottom-nav__footer-link block min-h-8 text-left leading-8"
        type="button"
      >
        {{ t(link) }}
      </button>
    </div>

    <div class="mt-14 flex flex-wrap gap-x-9 gap-y-5">
      <button class="pwa-bottom-nav__footer-link min-h-8 text-left leading-5" type="button">
        {{ t('pwaPage.footer.terms') }}
      </button>
      <button class="pwa-bottom-nav__footer-link min-h-8 text-left leading-5" type="button">
        {{ t('pwaPage.footer.privacy') }}
      </button>
      <button class="pwa-bottom-nav__footer-link min-h-8 text-left leading-5" type="button">
        {{ t('pwaPage.footer.about') }}
      </button>
      <button class="pwa-bottom-nav__footer-link min-h-8 text-left leading-5" type="button">
        {{ t('pwaPage.footer.developers') }}
      </button>
      <button class="pwa-bottom-nav__footer-link min-h-8 text-left leading-5" type="button">
        {{ t('pwaPage.footer.store') }}
      </button>
    </div>
  </footer>

  <nav
    class="pwa-bottom-nav fixed bottom-0 left-1/2 z-30 grid h-[70px] w-full max-w-none -translate-x-1/2 grid-cols-5 border-t border-[#d8dce2] bg-white text-[#5f6368]"
    aria-label="Google Play"
    data-pwa-static-tabbar
    @click.capture.stop.prevent
    @pointerdown.capture.stop.prevent
  >
    <div
      v-for="item in navItems"
      :key="item.labelKey"
      class="flex min-w-0 select-none flex-col items-center justify-center gap-1 text-[14px] font-normal leading-5"
      :class="item.key === activeNavKey ? 'text-[#00875f]' : 'text-[#4c5667]'"
      aria-hidden="true"
    >
      <svg width="25" height="25" :viewBox="item.viewBox" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <path fill-rule="evenodd" clip-rule="evenodd" :d="item.path" />
      </svg>
      <span class="truncate px-0.5">{{ t(item.labelKey) }}</span>
    </div>
  </nav>
</template>

<style scoped>
.pwa-bottom-nav__footer-link {
  font-size: 14px !important;
  font-weight: 400 !important;
}
</style>
