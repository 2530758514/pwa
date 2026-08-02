<script setup>
const letters = [...'loading...']

function waveStyle(index) {
  return { animationDelay: `${index * 70}ms` }
}
</script>

<template>
  <main class="identity-loading" aria-live="polite" aria-label="Loading">
    <div class="identity-loading__progress" role="progressbar" aria-label="Loading progress">
      <div class="identity-loading__progress-bar"></div>
    </div>

    <div class="identity-loading__visual">
      <div class="identity-loading__rings" aria-hidden="true">
        <span class="identity-loading__ring identity-loading__ring--one"></span>
        <span class="identity-loading__ring identity-loading__ring--two"></span>
        <span class="identity-loading__ring identity-loading__ring--three"></span>
        <span class="identity-loading__ring identity-loading__ring--four"></span>
      </div>
      <div class="identity-loading__text" aria-hidden="true">
        <span
          v-for="(letter, index) in letters"
          :key="`${letter}-${index}`"
          :style="waveStyle(index)"
        >
          {{ letter }}
        </span>
      </div>
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
  background: #343d44;
}

.identity-loading__progress {
  position: fixed;
  z-index: 1;
  top: 0;
  left: 0;
  width: 100%;
  height: 3px;
  overflow: hidden;
  background: rgb(255 255 255 / 12%);
}

.identity-loading__progress-bar {
  width: 38%;
  height: 100%;
  background: #27ae60;
  box-shadow: 0 0 10px rgb(39 174 96 / 55%);
  animation: identity-progress 1.8s ease-in-out infinite;
}

.identity-loading__visual {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  transform: translateY(-24px);
}

.identity-loading__rings {
  position: relative;
  width: 87px;
  aspect-ratio: 1;
}

.identity-loading__ring {
  position: absolute;
  border: 6px solid transparent;
  border-right-color: currentcolor;
  border-radius: 50%;
  animation: identity-rotate 1s linear infinite;
}

.identity-loading__ring--one {
  inset: 0;
  color: #eb4747;
}

.identity-loading__ring--two {
  inset: 4.5px;
  color: #ebeb47;
  animation-duration: 2s;
}

.identity-loading__ring--three {
  inset: 15px;
  color: #47eb47;
  animation-duration: 3s;
}

.identity-loading__ring--four {
  inset: 25.5px;
  color: #47ebeb;
  animation-duration: 4s;
}

.identity-loading__text {
  display: flex;
  min-height: 24px;
  color: #27ae60;
  font-size: 17px;
  font-weight: 600;
  line-height: 24px;
  letter-spacing: 0.5px;
}

.identity-loading__text span {
  display: inline-block;
  animation: identity-wave 1.2s ease-in-out infinite;
}

@keyframes identity-progress {
  0% {
    transform: translateX(-110%);
  }

  100% {
    transform: translateX(270%);
  }
}

@keyframes identity-rotate {
  to {
    transform: rotate(1turn);
  }
}

@keyframes identity-wave {
  0%,
  60%,
  100% {
    transform: translateY(0);
  }

  30% {
    color: #fff;
    transform: translateY(-7px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .identity-loading__progress-bar,
  .identity-loading__ring,
  .identity-loading__text span {
    animation: none;
  }

  .identity-loading__progress-bar {
    width: 100%;
    opacity: 0.75;
  }
}
</style>
