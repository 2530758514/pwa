<script setup>
import { computed, onBeforeUnmount, onMounted, shallowRef } from 'vue'
import { buildBlankBrowserOpenUrl, createBlankBrowserOpener, formatBlankBrowserReward } from '@/shared/pwa/blankBrowserOpen'
import titlePlaque from '@/assets/pwa/browser-guide/ios-guide-title-plaque.webp'
import shareTiles from '@/assets/pwa/browser-guide/ios-guide-share-tiles.webp'
import goldButton from '@/assets/pwa/browser-guide/gold-button-blank.webp'

const props = defineProps({
  amount: { type: [String, Number], default: '' },
  confirmed: Boolean,
})
const rewardText = computed(() => formatBlankBrowserReward(props.amount, props.confirmed))
const rewardSize = computed(() => ({
  'blank-browser-guide__reward--compact': rewardText.value.length > 5,
  'blank-browser-guide__reward--small': rewardText.value.length > 8,
}))
const plaqueFailed = shallowRef(false)
const buttonFailed = shallowRef(false)
const tilesFailed = shallowRef(false)
const isApple = /iPhone|iPad|iPod/i.test(navigator.userAgent + navigator.platform) ||
  (/Macintosh|MacIntel/i.test(navigator.userAgent + navigator.platform) && navigator.maxTouchPoints > 1)
const opener = createBlankBrowserOpener({
  target: buildBlankBrowserOpenUrl(window.location.href, isApple),
  navigate: target => { window.location.href = target },
  canOpen: () => document.visibilityState !== 'hidden',
})
onMounted(() => opener.start())
onBeforeUnmount(() => opener.dispose())
</script>

<template>
  <div class="blank-browser-guide" @click.stop>
    <section class="blank-browser-guide__panel" role="dialog" aria-modal="true" aria-labelledby="blank-browser-title" aria-describedby="blank-browser-description">
      <header class="blank-browser-guide__header">
        <img v-if="!plaqueFailed" :src="titlePlaque" alt="" width="1200" height="359" class="blank-browser-guide__plaque" @error="plaqueFailed = true" />
        <h1 id="blank-browser-title" class="blank-browser-guide__title">Open in Browser</h1>
      </header>
      <div v-if="rewardText" class="blank-browser-guide__hero" :class="{ 'blank-browser-guide__hero--wide': rewardText.length > 8 }">
        <div class="blank-browser-guide__offer">
          <div class="blank-browser-guide__reward" :class="rewardSize">{{ rewardText }}</div>
          <p class="blank-browser-guide__free-play">Free Play</p>
        </div>
        <img v-if="!tilesFailed" :src="shareTiles" alt="" width="720" height="426" class="blank-browser-guide__tiles" @error="tilesFailed = true" />
      </div>
      <p id="blank-browser-description" class="blank-browser-guide__description">This page is open inside another app. Open it in your browser to continue.</p>
      <button type="button" class="blank-browser-guide__open" @click="opener.open()">
        <img v-if="!buttonFailed" :src="goldButton" alt="" width="2085" height="258" @error="buttonFailed = true" />
        <span>Open in Browser</span>
      </button>
      <p class="blank-browser-guide__footer">If it stays in this app, use the app menu to open it in your browser.</p>
    </section>
  </div>
</template>

<style scoped>
.blank-browser-guide {
  position: fixed;
  inset: 0;
  z-index: 1000040;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  overflow: hidden;
  background: #000;
  color: #f6f4f0;
  overscroll-behavior: none;
  font-family: Arial, Helvetica, sans-serif;
}
.blank-browser-guide__panel {
  isolation: isolate;
  width: 100%;
  max-width: 430px;
  max-height: 100%;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 0 16px calc(16px + env(safe-area-inset-bottom, 0px));
  border: 1px solid #bd914b;
  border-top-color: #a4afc2;
  border-radius: 26px 26px 0 0;
  background:
    linear-gradient(145deg, #8791aa44 0%, #8791aa44 7%, transparent 7.1%) top left / 100% 210px no-repeat,
    linear-gradient(145deg, transparent 11%, #101827 11.1%, #10182799 22%, transparent 22.1%) top left / 100% 220px no-repeat,
    radial-gradient(ellipse at 90% 9%, #c27d241e, transparent 32%),
    radial-gradient(ellipse at 30% 55%, #323b51, transparent 65%),
    linear-gradient(125deg, #111827, #1c2335 45%, #0e1523);
  box-shadow: inset 0 1px 1px #e1e5ef88, inset 0 -1px 2px #ffc85e;
}
.blank-browser-guide__header {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 1200 / 359;
  width: 174px;
  max-width: 100%;
  margin: 0 auto 12px;
}
.blank-browser-guide__header::before {
  content: '';
  position: absolute;
  inset: 28% 1% 9%;
  border-radius: 10px;
  background: linear-gradient(130deg, #b68038, #ffdfa1 48%, #aa712d);
}
.blank-browser-guide__plaque { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: fill; }
.blank-browser-guide__title { position: relative; margin: 0; padding-top: 10px; font-size: 17px; line-height: 20px; font-weight: 700; letter-spacing: -0.6px; color: #15130d; white-space: nowrap; }
.blank-browser-guide__hero { display: flex; align-items: center; width: 174px; max-width: 100%; min-height: 46px; margin: 0 auto 16px; gap: 4px; }
.blank-browser-guide__hero--wide { width: 310px; }
.blank-browser-guide__hero--wide .blank-browser-guide__tiles { width: 80px; max-width: 30%; }
.blank-browser-guide__offer { flex: 1; min-width: 0; text-align: center; }
.blank-browser-guide__reward { font-size: 30px; font-weight: 900; line-height: 1.1; letter-spacing: -2px; overflow-wrap: anywhere; color: #ffd77c; background: linear-gradient(#fff0b0, #ffcf60 55%, #c98513 90%, #ffe7a2); background-clip: text; -webkit-text-fill-color: transparent; filter: drop-shadow(0 1px 0 #ffe4a0) drop-shadow(0 2px 1px #000); }
.blank-browser-guide__reward--compact { font-size: 26px; }
.blank-browser-guide__reward--small { font-size: 18px; letter-spacing: -1px; }
.blank-browser-guide__free-play { margin: 0; font-size: 10px; line-height: 15px; font-weight: 700; }
.blank-browser-guide__tiles { width: 50%; height: auto; aspect-ratio: 720 / 426; max-height: 46px; object-fit: contain; flex-shrink: 0; }
.blank-browser-guide__description { margin: 12px 0 18px; color: #dedee8; font-size: 14px; line-height: 21px; }
.blank-browser-guide__open { --blank-guide-hit-size: 44px; position: relative; display: flex; align-items: center; justify-content: center; width: 310px; max-width: 100%; min-height: var(--blank-guide-hit-size); aspect-ratio: 2085 / 258; margin: 0 auto; padding: 0; border: 0; border-radius: 999px; background: linear-gradient(130deg, #b68038, #ffdfa1 48%, #aa712d); color: #080704; font-size: 18px; line-height: 22px; font-weight: 700; cursor: pointer; }
.blank-browser-guide__open img { position: absolute; inset: 0; display: block; width: 100%; height: 100%; }
.blank-browser-guide__open span { position: relative; padding: 0 8px 2px; }
.blank-browser-guide__open:active { transform: scale(0.98); }
.blank-browser-guide__open:focus-visible { outline: 2px solid #ffe7a2; outline-offset: 3px; }
.blank-browser-guide__footer { margin: 12px 0 0; text-align: center; color: #bfc0cf; font-size: 11px; line-height: 16px; }
</style>
