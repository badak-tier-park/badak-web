<template>
  <template v-if="route.name !== 'auth-callback'">
    <div class="orb orb-1"></div>
    <div class="orb orb-2"></div>
    <div class="orb orb-3"></div>
    <div v-if="route.name !== 'login'" class="grid-overlay"></div>
  </template>
  <RouterView />
</template>

<script setup lang="ts">
import { RouterView, useRoute } from 'vue-router'

const route = useRoute()
</script>

<style>
html, body, #app {
  background: var(--c-bg);
}

.orb {
  position: fixed;
  border-radius: 50%;
  filter: blur(90px);
  opacity: 0.38;
  pointer-events: none;
  z-index: 0;
  animation: float 8s ease-in-out infinite;
}

[data-theme="light"] .orb {
  opacity: 0.12;
}

.orb-1 {
  width: 500px;
  height: 500px;
  background: radial-gradient(circle, #aa3bff, transparent);
  top: -120px;
  right: -80px;
  animation-delay: 0s;
}

.orb-2 {
  width: 400px;
  height: 400px;
  background: radial-gradient(circle, #5865f2, transparent);
  bottom: 0;
  left: -100px;
  animation-delay: -3s;
}

.orb-3 {
  width: 300px;
  height: 300px;
  background: radial-gradient(circle, #c084fc, transparent);
  top: calc(50vh - 150px);
  left: calc(50vw - 150px);
  animation-delay: -6s;
}

@keyframes float {
  0%, 100% { transform: translateY(0) scale(1); }
  33%       { transform: translateY(-30px) scale(1.05); }
  66%       { transform: translateY(20px) scale(0.97); }
}

.grid-overlay {
  position: fixed;
  inset: 0;
  background-image:
    linear-gradient(var(--c-grid-line) 1px, transparent 1px),
    linear-gradient(90deg, var(--c-grid-line) 1px, transparent 1px);
  background-size: 60px 60px;
  pointer-events: none;
  z-index: 0;
}
</style>
