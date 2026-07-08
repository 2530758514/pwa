<script setup>
import { computed } from 'vue'
import { PWA_SOURCE_ASSETS } from '@/content/pwaPageContent'
import PwaLoadingSpinner from '@/components/PwaLoadingSpinner.vue'

defineOptions({
  name: 'PwaInstallButton',
})

const props = defineProps({
  label: {
    type: String,
    required: true,
  },
  subtitle: {
    type: String,
    default: '',
  },
  loading: {
    type: Boolean,
    default: false,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['install'])

const buttonClasses = computed(() => [
  props.disabled ? 'opacity-75' : 'active:scale-[0.99]',
  props.loading ? 'cursor-wait' : 'cursor-pointer',
])
</script>

<template>
  <button
    type="button"
    data-pwa-install-action
    class="pwa-install-button relative mt-[38px] flex h-[54px] w-full flex-col items-center justify-center overflow-hidden rounded-lg bg-[#01875f] py-[5px] text-[16px] font-normal leading-6 text-[#ffe336] shadow-none transition"
    :class="buttonClasses"
    :disabled="disabled || loading"
    @click="emit('install')"
  >
    <span class="relative z-10 flex items-center justify-center gap-1.5 text-[#ffe336]">
      <PwaLoadingSpinner v-if="loading" color="#ffe336" :size="16" />
      <img v-else :src="PWA_SOURCE_ASSETS.rapidIcon" alt="" class="h-[20px] w-[15px] object-contain" />
      <span>{{ label }}</span>
    </span>
    <span v-if="subtitle" class="relative z-10 mt-1 text-[12px] font-normal text-white">
      {{ subtitle }}
    </span>
  </button>
</template>

<style scoped>
.pwa-install-button::before {
  content: '';
  position: absolute;
  top: -180px;
  left: 0;
  width: 30px;
  height: 220px;
  background: rgba(255, 255, 255, 0.75);
  transform: rotate(45deg);
  animation: pwaInstallSweep 4s ease-in-out infinite;
}

@keyframes pwaInstallSweep {
  0%,
  80% {
    opacity: 0;
    transform: translateX(0) scale(0) rotate(45deg);
  }

  81% {
    opacity: 0.55;
    transform: translateX(18px) scale(4) rotate(45deg);
  }

  100% {
    opacity: 0;
    transform: translateX(360px) scale(12) rotate(45deg);
  }
}
</style>
