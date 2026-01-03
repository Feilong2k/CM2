const fs = require('fs');
const path = require('path');

/**
 * Recursively find all .js files in a directory, excluding node_modules and __tests__ directories.
 * @param {string} dir - Directory to search
 * @returns {string[]} Array of file paths
 */
function getAllJsFiles(dir) {
  const files = [];
  const items = fs.readdirSync(dir, { withFileTypes: true });

  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      // Skip node_modules and __tests__ directories
      if (item.name === 'node_modules' || item.name === '__tests__') {
        continue;
      }
      files.push(...getAllJsFiles(fullPath));
    } else if (item.isFile() && item.name.endsWith('.js')) {
      files.push(fullPath);
    }
  }

  return files;
}

describe('DB module usage guardrail', () => {
  // Compute backend root relative to this test file's location.
  // The test file is at backend/src/db/__tests__/db_module_usage.spec.js
  const backendRoot = path.join(__dirname, '../../..');
  const allJsFiles = getAllJsFiles(backendRoot);

  // Relative paths of files that are allowed to import config/db (for now, until they are updated)
  const allowedRelPaths = [
    'apply_migration.js',
  ];

  it('should not import from config/db.js except in allowed transitional files', () => {
    const violations = [];

    for (const file of allJsFiles) {
      const relPath = path.relative(backendRoot, file);
      // Skip allowed files (they are expected to have the old import for now)
      if (allowedRelPaths.includes(relPath)) {
        continue;
      }

      const content = fs.readFileSync(file, 'utf8');
      // Pattern to match require statements for config/db (relative paths may vary)
      const patterns = [
        /require\s*\(\s*['"]\.\.\/config\/db['"]/,
        /require\s*\(\s*['"]\.\.\/\.\.\/config\/db['"]/,
        /require\s*\(\s*['"]\.\/config\/db['"]/,
        /require\s*\(\s*['"]config\/db['"]/,
        // Also check for import statements (ES modules)
        /import\s+.*from\s+['"]\.\.\/config\/db['"]/,
        /import\s+.*from\s+['"]\.\.\/\.\.\/config\/db['"]/,
        /import\s+.*from\s+['"]\.\/config\/db['"]/,
        /import\s+.*from\s+['"]config\/db['"]/,
      ];

      const hasViolation = patterns.some(pattern => pattern.test(content));
      if (hasViolation) {
        violations.push(file);
      }
    }

    // If there are violations, fail the test and list them
    if (violations.length > 0) {
      const violationList = violations.map(v => `  - ${v}`).join('\n');
      throw new Error(
        `Found ${violations.length} file(s) importing from config/db.js (should use src/db/connection.js):\n${violationList}`
      );
    }
  });

  // This test will fail until the allowed files are updated by Devon
  it('eventually, apply_migration.js and probe_skill_test.js should also use src/db/connection.js', () => {
    const violations = [];

    for (const relPath of allowedRelPaths) {
      const file = path.join(backendRoot, relPath);
      const description = relPath;

      if (!fs.existsSync(file)) {
        violations.push(`${description} does not exist (expected at ${file})`);
        continue;
      }

      const content = fs.readFileSync(file, 'utf8');
      // Check that they import from src/db/connection.js (or at least not from config/db)
      const hasOldImport = /require\s*\(\s*['"]\.\.\/config\/db['"]/.test(content) ||
                           /require\s*\(\s*['"]\.\.\/\.\.\/config\/db['"]/.test(content);
      // Match any relative path that ends with src/db/connection (including ./src/db/connection)
      const hasNewImport = /require\s*\(\s*['"](?:\.\.?\/)*src\/db\/connection['"]/.test(content);

      if (hasOldImport && !hasNewImport) {
        violations.push(description);
      }
    }

    if (violations.length > 0) {
      const violationList = violations.map(v => `  - ${v}`).join('\n');
      throw new Error(
        `The following files still import from config/db.js and should be updated to src/db/connection.js:\n${violationList}`
      );
    }
  });
});
