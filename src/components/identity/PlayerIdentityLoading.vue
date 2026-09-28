<script setup>
defineOptions({
  name: 'PlayerIdentityLoading',
})

defineProps({
  logoUrl: {
    type: String,
    default: '/pwa-icons/icon-512.png',
  },
})
</script>

<template>
  <main class="identity-loading" aria-live="polite" aria-label="Loading">
    <div class="identity-loading__visual">
      <img class="identity-loading__logo" :src="logoUrl" alt="" />
      <span class="identity-loading__dots" aria-hidden="true"></span>
    </div>
  </main>
</template>

<style scoped>
.identity-loading {
  position: fixed;
  inset: 0;
  z-index: 1000300;
  display: flex;
  min-height: 100vh;
  min-height: 100dvh;
  align-items: center;
  justify-content: center;
  color: #fff;
  background: #272d39;
}

.identity-loading__visual {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: min(6.4vw, 24Px);
}

.identity-loading__logo {
  width: min(52vw, 190Px);
  max-height: 90Px;
  object-fit: contain;
}

.identity-loading__dots {
  width: min(13.333333vw, 50Px);
  aspect-ratio: 4;
  --identity-dot: no-repeat radial-gradient(circle closest-side, #27ae60 90%, #0000);
  background:
    var(--identity-dot) 0% 50%,
    var(--identity-dot) 50% 50%,
    var(--identity-dot) 100% 50%;
  background-size: calc(100% / 3) 100%;
  animation: identity-dots 1s infinite linear;
}

@keyframes identity-dots {
  33% {
    background-size:
      calc(100% / 3) 0%,
      calc(100% / 3) 100%,
      calc(100% / 3) 100%;
  }

  50% {
    background-size:
      calc(100% / 3) 100%,
      calc(100% / 3) 0%,
      calc(100% / 3) 100%;
  }

  66% {
    background-size:
      calc(100% / 3) 100%,
      calc(100% / 3) 100%,
      calc(100% / 3) 0%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .identity-loading__dots {
    animation: none;
  }
}
</style>
