<template>
  <div class="max-w-2xl mx-auto p-8">
    <!-- DEBUG: Test button to verify rendering -->
    <button 
      class="fixed top-4 left-4 bg-red-500 hover:bg-red-600 text-white font-bold py-3 px-6 rounded-lg shadow-lg z-50"
      @click="testClick"
    >
      TEST BUTTON - Click me!
    </button>
    <h1 class="text-3xl font-bold text-gray-800 mb-4">Backend Health Check</h1>
    <p class="text-gray-600 mb-8">This page checks the health of the backend server at {{ backendUrl }}</p>

    <div class="border-4 rounded-xl p-6 mb-8" :class="{
      'border-blue-300 bg-blue-50': loading,
      'border-green-300 bg-green-50': healthData && healthData.status === 'healthy',
      'border-red-300 bg-red-50': error,
      'border-gray-300 bg-gray-50': !loading && !error && !healthData
    }">
      <div class="flex justify-between items-center mb-6">
        <h2 class="text-xl font-semibold text-gray-700">Health Status</h2>
        <span class="px-4 py-2 rounded-full text-white font-bold" :class="{
          'bg-blue-500': loading,
          'bg-green-500': healthData && healthData.status === 'healthy',
          'bg-red-500': error,
          'bg-gray-500': !loading && !error && !healthData
        }">
          {{ statusText }}
        </span>
      </div>

      <div v-if="loading" class="text-center py-4">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
        <p class="mt-2 text-blue-600">Checking backend health...</p>
      </div>

      <div v-else-if="error" class="text-center py-4">
        <p class="text-red-600 font-medium mb-4">Error: {{ error }}</p>
        <button 
          @click="checkHealth" 
          class="bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-4 rounded transition-colors"
        >
          Retry
        </button>
      </div>

      <div v-else-if="healthData" class="space-y-3 py-4">
        <div class="flex justify-between border-b border-gray-200 pb-2">
          <span class="font-medium text-gray-600">Status:</span>
          <span class="font-mono text-gray-800">{{ healthData.status }}</span>
        </div>
        <div class="flex justify-between border-b border-gray-200 pb-2">
          <span class="font-medium text-gray-600">Environment:</span>
          <span class="font-mono text-gray-800">{{ healthData.environment }}</span>
        </div>
        <div class="flex justify-between border-b border-gray-200 pb-2">
          <span class="font-medium text-gray-600">Last Checked:</span>
          <span class="font-mono text-gray-800">{{ lastChecked }}</span>
        </div>
        <div class="flex justify-between">
          <span class="font-medium text-gray-600">Timestamp:</span>
          <span class="font-mono text-gray-800">{{ healthData.timestamp }}</span>
        </div>
      </div>

      <div class="flex gap-4 mt-6">
        <button 
          @click="checkHealth" 
          :disabled="loading"
          class="flex-1 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white font-bold py-3 px-4 rounded transition-colors"
        >
          {{ loading ? 'Checking...' : 'Check Health' }}
        </button>
        <button 
          @click="togglePolling" 
          class="flex-1 bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-4 rounded transition-colors"
        >
          {{ isPolling ? 'Stop Polling' : 'Start Polling' }}
        </button>
      </div>

      <div v-if="isPolling" class="mt-4 p-3 bg-green-100 border border-green-200 rounded text-green-700">
        <p>Polling every 10 seconds. Last update: {{ lastChecked }}</p>
      </div>
    </div>

    <div class="bg-gray-50 rounded-xl p-6 border border-gray-200">
      <h3 class="text-lg font-semibold text-gray-700 mb-3">How it works:</h3>
      <ul class="list-disc pl-5 space-y-2 text-gray-600">
        <li>Click <span class="font-medium text-blue-600">"Check Health"</span> to manually check the backend health.</li>
        <li>Click <span class="font-medium text-green-600">"Start Polling"</span> to automatically check every 10 seconds.</li>
        <li><span class="font-medium text-green-600">Green status</span> indicates the backend is healthy and responding.</li>
        <li><span class="font-medium text-red-600">Red status</span> indicates an error connecting to the backend.</li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { useHealthCheck } from '@/composables/useHealthCheck';

const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';
const { healthData, loading, error, lastChecked, checkHealth, startPolling, statusColor, statusText } = useHealthCheck();

const isPolling = ref(false);
let stopPolling = null;

function togglePolling() {
  if (isPolling.value) {
    if (stopPolling) {
      stopPolling();
    }
    isPolling.value = false;
  } else {
    stopPolling = startPolling(10000);
    isPolling.value = true;
  }
}

function testClick() {
  alert('Test button clicked! The Vue component is rendering correctly.');
}

onMounted(() => {
  console.log('HealthCheckView mounted');
  checkHealth();
});

onUnmounted(() => {
  if (stopPolling) {
    stopPolling();
  }
});
</script>
