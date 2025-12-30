/** @type {import('jest').Config} */
const config = {
  verbose: true,
  testEnvironment: 'node',
  testMatch: [
    '**/__tests__/**/*.js?(x)',
    '**/?(*.)+(spec|test).js?(x)'
  ],
  collectCoverage: false,
  coverageDirectory: 'coverage',
  testPathIgnorePatterns: ['/node_modules/'],
  transform: {}
};

module.exports = config;
