<script setup>
defineOptions({
  name: 'PwaScreenshotCarousel',
})

defineProps({
  screenshots: {
    type: Array,
    default: () => [],
  },
})
</script>

<template>
  <section v-if="screenshots.length" class="mb-[30px] mt-[27px] overflow-hidden">
    <div class="flex h-[224px] w-full gap-[14px] overflow-x-auto px-[28px] no-scrollbar">
      <div
        v-for="(image, index) in screenshots"
        :key="`${image}-${index}`"
        class="h-[224px] w-[138px] shrink-0 overflow-hidden rounded-lg bg-[#f6f8f9]"
      >
        <img
          :src="image"
          :alt="`App screenshot ${index + 1}`"
          class="h-full w-full object-cover"
          loading="lazy"
        />
      </div>
    </div>
  </section>
</template>
