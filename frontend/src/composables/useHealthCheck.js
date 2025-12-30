/**
 * Health Check Composable
 * 
 * Goal: Provide reactive health check state and actions
 * 
 * Related:
 * - Project: Frontend
 * - Feature: F1 - Backend health check
 * 
 * Non-goals:
 * - API calls (handled in services)
 * - UI rendering (handled in components/views)
 */

import { ref } from 'vue';
import { fetchHealthStatus, startHealthPolling } from '@/services/healthApi';

export function useHealthCheck() {
  const healthData = ref(null);
  const loading = ref(false);
  const error = ref(null);
  const lastChecked = ref(null);

  /**
   * Fetches health status and updates reactive state
   */
  async function checkHealth() {
    loading.value = true;
    error.value = null;

    try {
      const data = await fetchHealthStatus();
      healthData.value = data;
      lastChecked.value = new Date();
    } catch (err) {
      error.value = err.message || 'Failed to fetch health status';
      healthData.value = null;
    } finally {
      loading.value = false;
    }
  }

  /**
   * Starts polling health status
   * @param {number} intervalMs - polling interval in milliseconds
   */
  function startPolling(intervalMs = 10000) {
    return startHealthPolling(
      intervalMs,
      (data) => {
        healthData.value = data;
        lastChecked.value = new Date();
        error.value = null;
      },
      (err) => {
        error.value = err.message || 'Polling error';
        healthData.value = null;
      }
    );
  }

  /**
   * Computed property for health status color
   */
  const statusColor = () => {
    if (loading.value) return 'blue';
    if (error.value) return 'red';
    if (healthData.value?.status === 'healthy') return 'green';
    return 'gray';
  };

  /**
   * Computed property for health status text
   */
  const statusText = () => {
    if (loading.value) return 'Checking...';
    if (error.value) return 'Error';
    if (healthData.value?.status === 'healthy') return 'Healthy';
    return 'Unknown';
  };

  return {
    // State
    healthData,
    loading,
    error,
    lastChecked,

    // Actions
    checkHealth,
    startPolling,

    // Computed
    statusColor,
    statusText,
  };
}
