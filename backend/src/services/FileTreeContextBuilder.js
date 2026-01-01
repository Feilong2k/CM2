const fs = require('fs');
const path = require('path');
const { loadIgnorePatterns } = require('../../tools/ignore_utils');

class FileTreeContextBuilder {
  /**
   * Builds a string representation of the file tree.
   * @param {string} rootPath - Absolute path to root directory
   * @param {Object} options
   * @param {number} options.maxDepth - Max recursion depth (default: Infinity)
   * @param {number} options.maxLines - Max output lines (default: 500)
   * @returns {string} The tree string
   */
  buildTree(rootPath, options = {}) {
    const { maxDepth = Infinity, maxLines = 500 } = options;

    // Validate that rootPath exists and is a directory
    if (!fs.existsSync(rootPath)) {
      throw new Error(`Path does not exist: ${rootPath}`);
    }

    const stats = fs.statSync(rootPath);
    if (!stats.isDirectory()) {
      // If a file is passed, we can still return its name, but the spec expects a directory.
      // We'll just return the file name for completeness.
      return path.basename(rootPath);
    }

    // Load ignore patterns for the root directory (includes .gitignore and default patterns)
    const ig = loadIgnorePatterns(rootPath);

    let lines = [];
    let lineCount = 0;
    let truncated = false;

    const traverse = (currentPath, depth, relativePath = '') => {
      if (depth > maxDepth) {
        return;
      }

      let entries;
      try {
        entries = fs.readdirSync(currentPath);
      } catch (err) {
        // If we cannot read the directory (e.g., permission denied), skip it.
        return;
      }

      // Sort: directories first, then files, alphabetically
      entries.sort((a, b) => {
        const aPath = path.join(currentPath, a);
        const bPath = path.join(currentPath, b);
        const aIsDir = fs.statSync(aPath).isDirectory();
        const bIsDir = fs.statSync(bPath).isDirectory();
        if (aIsDir && !bIsDir) return -1;
        if (!aIsDir && bIsDir) return 1;
        return a.localeCompare(b, 'en', { sensitivity: 'base' });
      });

      for (const entry of entries) {
        if (lineCount >= maxLines) {
          truncated = true;
          break;
        }

        const entryPath = path.join(currentPath, entry);
        const entryRelative = relativePath
          ? path.join(relativePath, entry)
          : entry;

        // Check if the entry is ignored by .gitignore patterns
        if (ig.ignores(entryRelative) || ig.ignores(entryRelative + '/')) {
          continue;
        }

        // Check depth: entry's depth = depth + 1
        if (depth + 1 > maxDepth) {
          continue; // skip this entry
        }

        // Add the entry to the output lines
        lines.push(entryRelative);
        lineCount++;

        // If it's a directory, recurse
        const isDirectory = fs.statSync(entryPath).isDirectory();
        if (isDirectory) {
          traverse(entryPath, depth + 1, entryRelative);
        }
      }
    };

    traverse(rootPath, 0);

    if (truncated) {
      lines.push('... (truncated)');
    }

    return lines.join('\n');
  }
}

module.exports = FileTreeContextBuilder;
