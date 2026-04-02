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
      path: '/maps/register',
      name: 'map-register',
      component: () => import('@/views/maps/MapRegisterView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/maps/:id/edit',
      name: 'map-edit',
      component: () => import('@/views/maps/MapEditView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/players',
      name: 'players',
      component: () => import('@/views/players/PlayersView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/leagues',
      name: 'leagues',
      component: () => import('@/views/leagues/LeaguesView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/leagues/:id',
      name: 'league-detail',
      component: () => import('@/views/leagues/LeagueDetailView.vue'),
      meta: { requiresAuth: true },
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

  if (to.name === 'login' && auth.user) {
    return { name: 'home' }
  }
})

export default router
