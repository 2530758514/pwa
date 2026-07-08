<script setup>
defineOptions({
  name: 'PwaLoadingSpinner',
})

defineProps({
  size: {
    type: Number,
    default: 16,
  },
  color: {
    type: String,
    default: '#01875f',
  },
})
</script>

<template>
  <span
    class="pwa-loading-spinner"
    :style="{
      width: `${size}px`,
      height: `${size}px`,
      borderColor: `${color}33`,
      borderTopColor: color,
    }"
  ></span>
</template>

<style scoped>
.pwa-loading-spinner {
  display: inline-block;
  border-width: 2px;
  border-style: solid;
  border-radius: 999px;
  animation: pwaLoadingSpin 0.8s linear infinite;
}

@keyframes pwaLoadingSpin {
  to {
    transform: rotate(360deg);
  }
}
</style>
