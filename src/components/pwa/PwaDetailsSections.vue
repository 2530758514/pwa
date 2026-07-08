<script setup>
import { computed } from 'vue'
import { t } from '@/content/pwaText'
import PwaIcon from '@/components/PwaIcon.vue'

defineOptions({
  name: 'PwaDetailsSections',
})

const props = defineProps({
  about: {
    type: String,
    required: true,
  },
  safetyItems: {
    type: Array,
    default: () => [],
  },
  tags: {
    type: Array,
    default: () => [],
  },
  updatedDate: {
    type: String,
    default: '',
  },
})

const resolvedSafetyItems = computed(() =>
  props.safetyItems.map((item) => ({
    title: item.titleKey ? t(item.titleKey) : item.title,
    subtitle: item.subtitleKey ? t(item.subtitleKey) : item.subtitle,
    icon: item.icon,
  })),
)
</script>

<template>
  <section class="px-[28px] text-[#202124]">
    <div class="mb-5 flex items-center justify-between">
      <h2 class="text-[18px] font-medium leading-[24px]">{{ t('pwaPage.about.title') }}</h2>
      <PwaIcon class="text-[#5f6368]" name="arrow" :size="24" />
    </div>

    <p
      v-if="about"
      class="pwa-details-sections__about break-words text-left text-[14px] font-normal leading-[20px] text-[#5f6368]"
      dir="auto"
    >
      {{ about }}
    </p>

    <div v-if="updatedDate" class="mt-8">
      <div class="text-[14px] font-medium leading-[20px] tracking-[0.25px] text-[#202124]">
        {{ t('pwaPage.about.updatedOn') }}
      </div>
      <div class="mt-1 text-[14px] font-normal leading-[20px] tracking-[0.2px] text-[#5f6368]">
        {{ updatedDate }}
      </div>
    </div>

    <div v-if="tags.length" class="mt-7 flex flex-wrap gap-x-3.5 gap-y-3">
      <span
        v-for="tag in tags"
        :key="tag"
        class="rounded-full border border-[#d4d8df] px-5 py-2 text-center text-[16px] font-normal leading-5 text-[#4c5667]"
        dir="auto"
      >
        {{ tag }}
      </span>
    </div>

    <section class="mt-9">
      <div class="mb-5 flex items-center justify-between">
        <h2 class="text-[18px] font-medium leading-[24px] text-[#202124]">{{ t('pwaPage.safety.title') }}</h2>
        <PwaIcon class="text-[#5f6368]" name="arrow" :size="14" />
      </div>

      <p class="break-words text-[14px] font-normal leading-[20px] text-[#4c5667]" dir="auto">
        {{ t('pwaPage.safety.description') }}
      </p>
    </section>

    <div class="mt-10 rounded-lg border border-[#d6d9de] px-[20px] pb-0 pt-[20px] text-[#4c5667]">
      <div
        v-for="item in resolvedSafetyItems"
        :key="item.title"
        class="flex min-h-[50px] items-start gap-7"
      >
        <span class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center text-[#73777c]">
          <PwaIcon :name="item.icon" :size="20" />
        </span>
        <div class="min-w-0 text-[14px] font-normal leading-[20px] text-[#5f6368]" dir="auto">
          <div>{{ item.title }}</div>
          <div v-if="item.subtitle" class="text-[14px] font-normal leading-[20px] text-[#5f6368]">
            {{ item.subtitle }}
          </div>
        </div>
      </div>

      <button class="pwa-details-sections__see-details h-8 text-[14px] font-normal" type="button">
        {{ t('pwaPage.safety.seeDetails') }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.pwa-details-sections__see-details {
  color: #01875f !important;
}

.pwa-details-sections__about {
  display: -webkit-box;
  max-height: 120px;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 5;
}
</style>
