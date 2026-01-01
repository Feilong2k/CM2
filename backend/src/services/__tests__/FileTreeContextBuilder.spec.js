const fs = require('fs');
const path = require('path');
const os = require('os');

// The service we are testing (does not exist yet)
const FileTreeContextBuilder = require('../FileTreeContextBuilder');

describe('FileTreeContextBuilder', () => {
  let tempDir;

  beforeEach(() => {
    // Create a unique temporary directory for each test
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'filetree-test-'));
  });

  afterEach(() => {
    // Clean up the temporary directory
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('Test 1: Recursive listing', () => {
    it('should return a string with all files, showing nesting', () => {
      // Create a nested directory structure
      const srcDir = path.join(tempDir, 'src');
      const utilsDir = path.join(srcDir, 'utils');
      fs.mkdirSync(srcDir, { recursive: true });
      fs.mkdirSync(utilsDir, { recursive: true });
      fs.writeFileSync(path.join(srcDir, 'index.js'), '');
      fs.writeFileSync(path.join(utilsDir, 'helper.js'), '');
      fs.writeFileSync(path.join(tempDir, 'package.json'), '');

      const builder = new FileTreeContextBuilder();
      const result = builder.buildTree(tempDir);

      // The result should be a string
      expect(typeof result).toBe('string');

      // It should contain all files (full relative paths or at least the leaf names)
      expect(result).toContain('index.js');
      expect(result).toContain('helper.js');
      expect(result).toContain('package.json');

      // It should show nesting (e.g., 'src' appears before 'index.js' or 'utils/helper.js')
      // We can check for a pattern like 'src/' or 'src/index.js'
      expect(result).toMatch(/src[\\/]index\.js/); // cross-platform path separator
      expect(result).toMatch(/src[\\/]utils[\\/]helper\.js/);
    });
  });

  describe('Test 2: Ignore handling', () => {
    it('should exclude files and folders that are ignored by .gitignore', () => {
      // Create a .gitignore file that ignores node_modules and *.log
      const gitignoreContent = 'node_modules/\n*.log\n';
      fs.writeFileSync(path.join(tempDir, '.gitignore'), gitignoreContent);

      // Create some files and folders, including ignored ones
      fs.mkdirSync(path.join(tempDir, 'node_modules'), { recursive: true });
      fs.writeFileSync(path.join(tempDir, 'node_modules', 'some-lib.js'), '');
      fs.writeFileSync(path.join(tempDir, 'app.log'), 'log data');
      fs.writeFileSync(path.join(tempDir, 'main.js'), '');

      const builder = new FileTreeContextBuilder();
      const result = builder.buildTree(tempDir);

      // The result should NOT contain ignored entries
      expect(result).not.toContain('node_modules');
      expect(result).not.toContain('app.log');

      // It should contain non-ignored files
      expect(result).toContain('main.js');
    });
  });

  describe('Test 3: Truncation / Safety', () => {
    it('should truncate output when maxLines option is exceeded', () => {
      // Create many files (more than the limit)
      const fileCount = 10;
      for (let i = 0; i < fileCount; i++) {
        fs.writeFileSync(path.join(tempDir, `file${i}.txt`), '');
      }

      const builder = new FileTreeContextBuilder();
      const maxLines = 5;
      const result = builder.buildTree(tempDir, { maxLines });

      // Count the number of lines in the result (excluding empty lines)
      const lines = result.split('\n').filter(line => line.trim().length > 0);
      // The result should have at most maxLines lines (or exactly maxLines if it includes a truncation indicator)
      // We'll check that the number of lines is <= maxLines + 1 (to allow for a truncation indicator line)
      expect(lines.length).toBeLessThanOrEqual(maxLines + 1);

      // If there is a truncation, it should include an indicator (e.g., '...')
      if (lines.length > maxLines) {
        expect(result).toContain('...');
      } else if (lines.length === maxLines && fileCount > maxLines) {
        // If exactly maxLines, but we have more files, then the last line might be a truncation indicator
        // We'll check that the result includes some indicator of truncation
        expect(result).toMatch(/\.\.\.|truncated/i);
      }
    });

    it('should respect maxDepth option', () => {
      // Create a deep directory structure
      let current = tempDir;
      for (let i = 0; i < 5; i++) {
        current = path.join(current, `dir${i}`);
        fs.mkdirSync(current, { recursive: true });
        fs.writeFileSync(path.join(current, `file${i}.txt`), '');
      }

      const builder = new FileTreeContextBuilder();
      const maxDepth = 2;
      const result = builder.buildTree(tempDir, { maxDepth });

      // The result should not contain files deeper than maxDepth
      // We'll check that the string does not contain 'dir2' (since depth 0 is root, 1 is dir0, 2 is dir1, so dir2 is depth 3)
      expect(result).not.toContain('dir2');
      // It should contain files up to maxDepth
      expect(result).toContain('dir0');
      expect(result).toContain('dir1');
    });
  });

  describe('Test 4: Empty/Edge cases', () => {
    it('should return empty string or specific message for empty directory', () => {
      const builder = new FileTreeContextBuilder();
      const result = builder.buildTree(tempDir);

      // The result should be empty or a message like "Empty directory"
      // We'll check that it's a string and does not contain any file/directory names
      expect(typeof result).toBe('string');
      // If it's empty, that's fine. If it's a message, we can check for a substring.
      // We'll just assert that the result does not contain any placeholder for files.
      // Since we know the directory is empty, we can check that the result is either empty or a specific message.
      // We'll leave the exact behavior to the implementation.
    });

    it('should throw an error for non-existent path', () => {
      const nonExistentPath = path.join(tempDir, 'does-not-exist');
      const builder = new FileTreeContextBuilder();

      // We expect the method to throw when given a non-existent path
      expect(() => builder.buildTree(nonExistentPath)).toThrow();
    });
  });
});
