import { createRouter, createWebHashHistory } from 'vue-router'
import HealthCheckView from '@/views/HealthCheckView.vue'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'health-check',
      component: HealthCheckView,
    },
  ],
})

export default router
