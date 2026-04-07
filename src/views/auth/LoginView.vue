<template>
  <div class="login-page">
    <div class="grid-overlay"></div>

    <div class="login-card">
      <div class="card-glow"></div>

      <!-- Logo / Brand -->
      <div class="brand">
        <div class="brand-icon">
          <svg width="44" height="44" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="iconGrad" x1="0" y1="0" x2="44" y2="44" gradientUnits="userSpaceOnUse">
                <stop stop-color="#aa3bff"/>
                <stop offset="1" stop-color="#5865f2"/>
              </linearGradient>
              <filter id="iconGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="2" result="blur"/>
                <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
            </defs>
            <!-- 배경 -->
            <rect width="44" height="44" rx="12" fill="url(#iconGrad)"/>
            <!-- 내부 하이라이트 -->
            <rect x="0.5" y="0.5" width="43" height="43" rx="11.5" stroke="white" stroke-opacity="0.15"/>
            <!-- 산/티어 심볼: 3단 계층 -->
            <path d="M22 9L31 25H13L22 9Z" fill="white" opacity="0.95" filter="url(#iconGlow)"/>
            <path d="M22 18L27.5 27H16.5L22 18Z" fill="white" opacity="0.3"/>
            <!-- 하단 라인 -->
            <rect x="11" y="30" width="22" height="2" rx="1" fill="white" opacity="0.4"/>
          </svg>
        </div>
        <div class="brand-text">
          <span class="brand-name"><span class="brand-em">바닥</span>티어</span>
        </div>
      </div>

      <div class="divider"></div>

      <!-- Main content -->
      <div class="card-content">
        <h1 class="title">환영합니다</h1>
        <p class="subtitle">디스코드 계정으로 로그인하여<br>관리자 페이지에 접속하세요</p>

        <button class="discord-btn" @click="auth.loginWithDiscord()" :disabled="auth.loading">
          <span class="btn-icon">
            <svg width="20" height="20" viewBox="0 0 127.14 96.36" xmlns="http://www.w3.org/2000/svg">
              <path fill="currentColor" d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z"/>
            </svg>
          </span>
          <span class="btn-text">Discord로 로그인</span>
          <span class="btn-arrow">→</span>
        </button>

        <p class="terms">로그인 시 서비스 이용약관에 동의하게 됩니다</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
</script>

<style lang="scss" scoped>
@use './LoginView.scss';
</style>
