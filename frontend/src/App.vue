<script setup>
import { ref, onErrorCaptured } from 'vue'
import { RouterView } from 'vue-router'

const error = ref(null)

onErrorCaptured((err) => {
  console.error('App error captured:', err)
  error.value = err.message
  return false
})
</script>

<template>
  <div id="app">
    <div v-if="error" class="error-overlay">
      <h1>Application Error</h1>
      <p>{{ error }}</p>
      <button @click="window.location.reload()">Reload Page</button>
    </div>
    <div v-else>
      <RouterView />
    </div>
  </div>
</template>

<style scoped>
.error-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: #f8d7da;
  color: #721c24;
  padding: 2rem;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  z-index: 9999;
}

.error-overlay h1 {
  font-size: 2rem;
  margin-bottom: 1rem;
}

.error-overlay p {
  font-size: 1.2rem;
  margin-bottom: 2rem;
  max-width: 600px;
  text-align: center;
}

.error-overlay button {
  padding: 0.75rem 1.5rem;
  background: #721c24;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  cursor: pointer;
}
</style>
