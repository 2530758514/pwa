<script setup>
defineOptions({
  name: 'PwaPageSkeleton',
})
</script>

<template>
  <div class="pwa-page-skeleton min-h-screen bg-white px-[22px] pt-[72px] text-[#202124]">
    <div class="flex items-start gap-[25px]">
      <div class="h-[74px] w-[74px] rounded-[12px] bg-[#edf1f3]"></div>
      <div class="min-w-0 flex-1 space-y-3 pt-1">
        <div class="h-7 w-[68%] rounded bg-[#edf1f3]"></div>
        <div class="h-5 w-[46%] rounded bg-[#edf1f3]"></div>
        <div class="h-4 w-[72%] rounded bg-[#edf1f3]"></div>
      </div>
    </div>
    <div class="mt-9 grid grid-cols-3 gap-4">
      <div class="h-12 rounded bg-[#edf1f3]"></div>
      <div class="h-12 rounded bg-[#edf1f3]"></div>
      <div class="h-12 rounded bg-[#edf1f3]"></div>
    </div>
    <div class="mt-9 h-[54px] rounded-lg bg-[#edf1f3]"></div>
    <div class="mt-8 flex gap-[14px] overflow-hidden">
      <div class="h-[224px] w-[138px] shrink-0 rounded-lg bg-[#edf1f3]"></div>
      <div class="h-[224px] w-[138px] shrink-0 rounded-lg bg-[#edf1f3]"></div>
      <div class="h-[224px] w-[138px] shrink-0 rounded-lg bg-[#edf1f3]"></div>
    </div>
  </div>
</template>

<style scoped>
.pwa-page-skeleton * {
  animation: pwaSkeletonPulse 1.2s ease-in-out infinite;
}

@keyframes pwaSkeletonPulse {
  0%,
  100% {
    opacity: 0.58;
  }

  50% {
    opacity: 1;
  }
}
</style>
