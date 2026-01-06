/**
 * Backend Server
 * 
 * Goal: Provide a production-ready Express server with proper security and layered architecture
 * 
 * Related:
 * - Project: Backend API
 * - Feature: F1 - Express server setup
 * - Checklist: Set up dependencies and devDependencies
 * 
 * Non-goals:
 * - Business logic (handled in services)
 * - Database access (handled in models)
 * - HTTP routing details (handled in routes)
 */

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
require('dotenv').config();

// Initialize Express app
const app = express();

// 1. Security middleware
app.use(helmet());

// 2. CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));

// 3. Body parsing middleware
app.use(express.json({ limit: '12mb' }));
app.use(express.urlencoded({ extended: true }));

// 4. Health check route
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV === 'test' ? 'development' : (process.env.NODE_ENV || 'development')
  });
});

// 5. API routes
// Write session routes
app.use('/api/write-session', require('./src/routes/writeSession.routes'));

// 6. 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl,
    method: req.method
  });
});

// 7. Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// Server configuration
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || 'localhost';

// Start server
if (require.main === module) {
  app.listen(PORT, HOST, () => {
    console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode`);
    console.log(`Listening on http://${HOST}:${PORT}`);
    console.log(`Health check: http://${HOST}:${PORT}/health`);
  });
}

module.exports = app;
