import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import './style.css'

console.log('main.js: Starting Vue app initialization')

const app = createApp(App)

// Global error handler
app.config.errorHandler = (err, vm, info) => {
  console.error('Vue error:', err, info)
}

app.use(createPinia())
app.use(router)

// Try mounting with error handling
try {
  app.mount('#app')
  console.log('main.js: App mounted')
} catch (error) {
  console.error('Failed to mount app:', error)
}

// Log router errors
router.onError((error) => {
  console.error('Router error:', error)
})

// Log when navigation is done
router.isReady().then(() => {
  console.log('Router is ready')
}).catch((error) => {
  console.error('Router failed to become ready:', error)
})
