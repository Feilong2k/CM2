import { createApp } from 'vue'
import './style.css'

console.log('main-test.js loaded')

document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded')
  const app = createApp({
    template: `
      <div class="p-8">
        <h1 class="text-3xl font-bold text-red-500">Test Vue App</h1>
        <p class="text-lg">If you see this, Vue is working!</p>
        <button class="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded">
          Test Button
        </button>
      </div>
    `
  })
  app.mount('#app')
  console.log('Vue app mounted')
})
