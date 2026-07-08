<script setup>
import { computed } from 'vue'
import { t } from '@/content/pwaText'
import PwaIcon from '@/components/PwaIcon.vue'

defineOptions({
  name: 'PwaRatingsReviews',
})

const props = defineProps({
  ratingBars: {
    type: Array,
    default: () => [],
  },
  reviews: {
    type: Array,
    default: () => [],
  },
})

const DISPLAY_RATING = '4.5'
const DISPLAY_REVIEW_COUNT = '125K reviews'
const orderedBars = computed(() => [...props.ratingBars].sort((a, b) => b.stars - a.stars))
const avatarColors = ['#4f83cc', '#8a63d2', '#d18b2d']

function getAvatarLabel(review, index) {
  const name = String(review?.name || '').trim()

  return name.slice(0, 1) || String(index + 1)
}

function getAvatarStyle(index) {
  return {
    backgroundColor: avatarColors[index % avatarColors.length],
  }
}
</script>

<template>
  <section class="px-[22px] pt-7 text-[#202124]">
    <div class="mb-5 flex items-center justify-between">
      <h2 class="text-[18px] font-medium leading-[24px] text-[#202124]">{{ t('pwaPage.ratings.title') }}</h2>
      <PwaIcon class="text-[#5f6368]" name="arrow" :size="14" />
    </div>

    <p class="flex items-center gap-2 text-[14px] leading-5 tracking-[0.12px] text-[#4c5667]">
      {{ t('pwaPage.ratings.verified') }}
      <PwaIcon name="info" :size="16" />
    </p>

    <div class="mt-12 flex gap-3">
      <button
        type="button"
        class="flex h-8 items-center justify-center gap-2 rounded-full bg-[#e1f1ec] px-3 text-[14px] text-[#00875f]"
      >
        <PwaIcon name="phone" :size="16" />
        <span>{{ t('pwaPage.ratings.phone') }}</span>
      </button>
      <button
        type="button"
        class="flex h-8 items-center justify-center gap-2 rounded-full border border-[#d7dbe1] px-3 text-[14px] text-[#4c5667]"
      >
        <PwaIcon name="desktop" :size="16" />
        <span>{{ t('pwaPage.ratings.tablet') }}</span>
      </button>
    </div>

    <div class="mt-12 grid grid-cols-[110px_1fr] gap-2">
      <div class="min-w-0">
        <div class="text-[56px] font-normal leading-[60px] text-[#202124]">{{ DISPLAY_RATING }}</div>
        <div class="mt-2 flex text-[#00875f]">
          <span v-for="star in 4" :key="star" class="text-[20px] leading-none">&#9733;</span>
          <span class="pwa-ratings-reviews__half-star text-[20px] leading-none">&#9733;</span>
        </div>
        <div class="pwa-ratings-reviews__count">{{ DISPLAY_REVIEW_COUNT }}</div>
      </div>

      <div class="min-w-0 pt-0.5">
        <div
          v-for="bar in orderedBars"
          :key="bar.stars"
          class="grid h-5 grid-cols-[12px_190px] items-center gap-2"
        >
          <span class="text-[14px] leading-5 text-[#1f252c]">{{ bar.stars }}</span>
          <span class="h-[10px] w-[190px] overflow-hidden rounded-full bg-[#e8eaed]">
            <span
              class="block h-full rounded-full bg-[#00875f]"
              :style="{ width: `${bar.percent}%` }"
            ></span>
          </span>
        </div>
      </div>
    </div>

    <div v-if="reviews.length" class="mt-8">
      <article v-for="(review, index) in reviews" :key="review.id" class="pb-6">
        <div class="flex items-center justify-between gap-3">
          <div class="flex min-w-0 items-center gap-3">
            <span
              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[16px] font-semibold text-white"
              :style="getAvatarStyle(index)"
              aria-hidden="true"
            >
              {{ getAvatarLabel(review, index) }}
            </span>
            <div class="min-w-0 truncate text-[16px] leading-[22px] text-[#202124]">
              {{ review.name }}
            </div>
          </div>
          <PwaIcon name="more" class="shrink-0 text-[#5f6368]" :size="24" />
        </div>

        <div class="mt-3 flex items-center gap-3">
          <div class="flex text-[#00875f]">
            <span v-for="star in 5" :key="star" class="text-[14px] leading-none">&#9733;</span>
          </div>
          <span class="text-[14px] leading-5 text-[#5f6368]">{{ review.date }}</span>
        </div>

        <p class="mt-3 break-words text-[16px] leading-[25px] text-[#5f6368]" dir="auto">
          {{ review.text }}
        </p>

        <div class="mt-4 flex items-center gap-2 text-[14px] leading-5 text-[#5f6368]">
          <span>{{ t('pwaPage.ratings.helpful') }}</span>
          <button class="h-[30px] min-w-[62px] rounded-full border border-[#d7dbe1] text-[#5f6368]" type="button">
            {{ t('pwaPage.ratings.yes') }}
          </button>
          <button class="h-[30px] min-w-[62px] rounded-full border border-[#d7dbe1] text-[#5f6368]" type="button">
            {{ t('pwaPage.ratings.no') }}
          </button>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.pwa-ratings-reviews__count {
  color: #5f6368;
  font-family: Roboto, Arial, sans-serif;
  line-height: 1rem;
  font-size: 0.75rem;
  letter-spacing: 0.025em;
  font-weight: 400;
  margin-top: 0.5rem;
}

.pwa-ratings-reviews__half-star {
  position: relative;
  color: #d8dde3;
}

.pwa-ratings-reviews__half-star::before {
  position: absolute;
  inset: 0;
  width: 50%;
  overflow: hidden;
  color: #00875f;
  content: '\2605';
}
</style>
