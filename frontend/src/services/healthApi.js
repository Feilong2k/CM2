/**
 * Health API Service
 * 
 * Goal: Provide a service to check backend health status
 * 
 * Related:
 * - Project: Frontend
 * - Feature: F1 - Backend health check
 * 
 * Non-goals:
 * - Business logic (handled in composables)
 * - UI rendering (handled in components/views)
 */

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';

/**
 * Fetches the health status from the backend server
 * @returns {Promise<{status: string, timestamp: string, environment: string}>}
 */
export async function fetchHealthStatus() {
  try {
    const response = await fetch(`${BACKEND_URL}/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      // credentials: 'include' // if needed for cookies
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching health status:', error);
    throw error;
  }
}

/**
 * Health status polling utility
 * @param {number} intervalMs - polling interval in milliseconds
 * @param {function} onUpdate - callback with health data
 * @param {function} onError - error callback
 * @returns {function} - function to stop polling
 */
export function startHealthPolling(intervalMs = 10000, onUpdate, onError) {
  let isActive = true;

  const poll = async () => {
    if (!isActive) return;

    try {
      const healthData = await fetchHealthStatus();
      onUpdate(healthData);
    } catch (error) {
      onError(error);
    }

    if (isActive) {
      setTimeout(poll, intervalMs);
    }
  };

  poll();

  return () => {
    isActive = false;
  };
}
