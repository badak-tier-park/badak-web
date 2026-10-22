<template>
  <template v-if="route.name !== 'auth-callback'">
    <div class="orb orb-1"></div>
    <div class="orb orb-2"></div>
    <div class="orb orb-3"></div>
    <div v-if="route.name !== 'login'" class="grid-overlay"></div>
  </template>
  <RouterView />
  <PwaUpdatePrompt />
  <PwaInstallPrompt />
</template>

<script setup lang="ts">
import { RouterView, useRoute } from 'vue-router'
import PwaUpdatePrompt from '@/components/PwaUpdatePrompt.vue'
import PwaInstallPrompt from '@/components/PwaInstallPrompt.vue'

const route = useRoute()
</script>

<style lang="scss">
@use './App.scss';
</style>
