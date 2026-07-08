<script setup>
defineOptions({
  name: 'PwaIcon',
})

defineProps({
  name: {
    type: String,
    required: true,
  },
  size: {
    type: [String, Number],
    default: 20,
  },
})

const paths = {
  arrow: 'M8.7 5.3 13.4 10l-4.7 4.7-1.4-1.4L10.6 10 7.3 6.7l1.4-1.4Z',
  share: 'M14 5a3 3 0 1 0-2.83-4H11a3 3 0 0 0 2.18 5.06L8.9 8.43a3.02 3.02 0 0 0-2.02-.74 3 3 0 1 0 2.02.79l4.26 2.36A3 3 0 1 0 14 9a2.98 2.98 0 0 0-1.84.63L7.91 7.27A3.02 3.02 0 0 0 8 6.69a3.02 3.02 0 0 0-.09-.73l4.25-2.35A3 3 0 0 0 14 5Z',
  bookmark: 'M5 3.5A2.5 2.5 0 0 1 7.5 1h5A2.5 2.5 0 0 1 15 3.5V17l-5-3-5 3V3.5Zm2.5-.5a.5.5 0 0 0-.5.5v9.97l3-1.8 3 1.8V3.5a.5.5 0 0 0-.5-.5h-5Z',
  info: 'M10 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16Zm0-2a6 6 0 1 0 0-12 6 6 0 0 0 0 12Zm-1-7h2v5H9V9Zm0-3h2v2H9V6Z',
  phone: 'M7 1h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2Zm0 3v12h6V4H7Zm2 13h2v1H9v-1Z',
  desktop: 'M3 3h14v10H3V3Zm2 2v6h10V5H5Zm-1 10h12v2H4v-2Zm5-2h2v2H9v-2Z',
  upload: 'M10 2 5.5 6.5 7 8l2-2v7h2V6l2 2 1.5-1.5L10 2ZM4 15h12v2H4v-2Z',
  lock: 'M6 8V6a4 4 0 1 1 8 0v2h1v9H5V8h1Zm2 0h4V6a2 2 0 1 0-4 0v2Zm-1 2v5h6v-5H7Z',
  close: 'M5.64 4.22 10 8.59l4.36-4.37 1.42 1.42L11.41 10l4.37 4.36-1.42 1.42L10 11.41l-4.36 4.37-1.42-1.42L8.59 10 4.22 5.64l1.42-1.42Z',
  more: 'M5 10a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm7 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm7 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z',
}
</script>

<template>
  <svg
    aria-hidden="true"
    :width="size"
    :height="size"
    viewBox="0 0 20 20"
    fill="currentColor"
    focusable="false"
  >
    <path :d="paths[name] || paths.info" />
  </svg>
</template>
