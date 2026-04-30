import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/views/home/HomeView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/auth/LoginView.vue'),
    },
    {
      path: '/maps',
      name: 'maps',
      component: () => import('@/views/maps/MapsView.vue'),
      meta: { requiresAuth: true, requiresAdmin: true },
    },
    {
      path: '/maps/register',
      name: 'map-register',
      component: () => import('@/views/maps/MapRegisterView.vue'),
      meta: { requiresAuth: true, requiresAdmin: true },
    },
    {
      path: '/maps/:id/edit',
      name: 'map-edit',
      component: () => import('@/views/maps/MapEditView.vue'),
      meta: { requiresAuth: true, requiresAdmin: true },
    },
    {
      path: '/players',
      name: 'players',
      component: () => import('@/views/players/PlayersView.vue'),
      meta: { requiresAuth: true, requiresAdmin: true },
    },
    {
      path: '/games',
      name: 'games',
      component: () => import('@/views/games/GamesView.vue'),
      meta: { requiresAuth: true, requiresAdmin: true },
    },
    {
      path: '/leagues',
      name: 'leagues',
      component: () => import('@/views/leagues/LeaguesView.vue'),
      meta: { requiresAuth: true, requiresAdmin: true },
    },
    {
      path: '/leagues/:id',
      name: 'league-detail',
      component: () => import('@/views/leagues/LeagueDetailView.vue'),
      meta: { requiresAuth: true, requiresAdmin: true },
    },
    {
      path: '/leagues/:id/draft',
      name: 'league-draft',
      component: () => import('@/views/leagues/DraftView.vue'),
      meta: { requiresAuth: true, requiresAdmin: true },
    },
    {
      path: '/leagues/:id/captain-draft',
      name: 'captain-draft',
      component: () => import('@/views/leagues/CaptainDraftView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/leagues/:id/team-names',
      name: 'league-team-names',
      component: () => import('@/views/leagues/TeamNamesView.vue'),
      meta: { requiresAuth: true, requiresAdmin: true },
    },
    {
      path: '/leagues/:id/schedule',
      name: 'league-schedule',
      component: () => import('@/views/leagues/ScheduleView.vue'),
      meta: { requiresAuth: true, requiresAdmin: true },
    },
    {
      path: '/leagues/:id/match-result',
      name: 'league-match-result',
      component: () => import('@/views/leagues/MatchResultView.vue'),
      meta: { requiresAuth: true, requiresAdmin: true },
    },
    {
      path: '/leagues/:id/playoffs',
      name: 'league-playoffs',
      component: () => import('@/views/leagues/PlayoffsView.vue'),
      meta: { requiresAuth: true, requiresAdmin: true },
    },
    {
      path: '/leagues/:id/schedule/:matchId/result',
      name: 'league-match-slot-result',
      component: () => import('@/views/leagues/MatchSlotResultView.vue'),
      meta: { requiresAuth: true, requiresAdmin: true },
    },
    {
      path: '/participate',
      name: 'participate',
      component: () => import('@/views/participate/ParticipateView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/hall-of-fame',
      name: 'hall-of-fame',
      component: () => import('@/views/hof/HallOfFameView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/dashboard',
      name: 'dashboard',
      component: () => import('@/views/dashboard/DashboardView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/seasons',
      name: 'seasons',
      component: () => import('@/views/seasons/SeasonsView.vue'),
      meta: { requiresAuth: true, requiresAdmin: true },
    },
    {
      path: '/auth/callback',
      name: 'auth-callback',
      component: () => import('@/views/auth/AuthCallbackView.vue'),
    },
  ],
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()

  if (auth.loading) {
    await auth.init()
  }

  if (to.meta.requiresAuth && !auth.user) {
    return { name: 'login' }
  }

  if (to.meta.requiresAdmin && !auth.isAdmin) {
    return { name: 'home' }
  }

  if (to.name === 'login' && auth.user) {
    return { name: 'home' }
  }
})

export default router
