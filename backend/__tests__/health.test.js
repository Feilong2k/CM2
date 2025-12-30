/**
 * Health endpoint tests
 * 
 * Goal: Verify the Express server health endpoint works correctly
 * 
 * Non-goals:
 * - Testing business logic
 * - Testing database connections
 */

const request = require('supertest');
const app = require('../index');

describe('GET /health', () => {
  it('should return 200 and healthy status', async () => {
    const response = await request(app).get('/health');
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status', 'healthy');
    expect(response.body).toHaveProperty('timestamp');
    expect(response.body).toHaveProperty('environment');
  });

  it('should include development environment by default', async () => {
    const response = await request(app).get('/health');
    
    expect(response.body.environment).toBe('development');
  });
});

describe('404 handler', () => {
  it('should return 404 for non-existent routes', async () => {
    const response = await request(app).get('/non-existent-route');
    
    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('error', 'Route not found');
    expect(response.body).toHaveProperty('path', '/non-existent-route');
    expect(response.body).toHaveProperty('method', 'GET');
  });
});
