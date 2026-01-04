const fs = require('fs').promises;
const path = require('path');
const yaml = require('js-yaml');

class SkillLoader {
  /**
   * @param {string} [rootDir] - Root directory to scan for SKILL.md files.
   *                             If not provided, defaults to backend/Skills.
   */
  constructor(rootDir) {
    if (rootDir) {
      this.rootDir = rootDir;
    } else {
      // Default to backend/Skills relative to this file's location
      this.rootDir = path.join(__dirname, '../../Skills');
    }
  }

  /**
   * Recursively scans the root directory for SKILL.md files.
   * @returns {Promise<string[]>} Array of absolute paths to SKILL.md files.
   */
  async _findSkillFiles() {
    const skillFiles = [];
    const stack = [this.rootDir];

    while (stack.length) {
      const currentDir = stack.pop();
      let entries;
      try {
        entries = await fs.readdir(currentDir, { withFileTypes: true });
      } catch (err) {
        // If we cannot read the directory, skip it and log a warning.
        console.warn(`SkillLoader: cannot read directory ${currentDir} – ${err.message}`);
        continue;
      }

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
          stack.push(fullPath);
        } else if (entry.isFile() && entry.name === 'SKILL.md') {
          skillFiles.push(fullPath);
        }
      }
    }

    return skillFiles;
  }

  /**
   * Extracts YAML frontmatter from a SKILL.md file content.
   * Frontmatter is expected to be between --- and --- delimiters.
   * @param {string} content - The file content.
   * @returns {object|null} Parsed YAML object, or null if not found or invalid.
   */
  _extractFrontmatter(content) {
    const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n/;
    const match = content.match(frontmatterRegex);
    if (!match) {
      return null;
    }
    try {
      return yaml.load(match[1]);
    } catch (err) {
      return null;
    }
  }

  /**
   * Loads metadata for all valid SKILL.md files in the root directory.
   * @returns {Promise<Array>} Array of metadata objects, each containing:
   *   - path: relative path from rootDir to the SKILL.md file.
   *   - name: skill name (from frontmatter).
   *   - description: skill description (from frontmatter).
   *   - type: normalized type (lowercase string, or null if missing).
   *   - tags: normalized tags (array of lowercase strings, or [] if missing).
   *   - frontmatter: the entire parsed YAML frontmatter object.
   */
  async loadSkillMetadata() {
    const skillFiles = await this._findSkillFiles();
    const metadata = [];

    for (const filePath of skillFiles) {
      let content;
      try {
        content = await fs.readFile(filePath, 'utf8');
      } catch (err) {
        console.warn(`SkillLoader: failed to read ${filePath} – ${err.message}`);
        continue;
      }

      const frontmatter = this._extractFrontmatter(content);
      if (!frontmatter || typeof frontmatter !== 'object') {
        console.warn(`SkillLoader: no valid frontmatter in ${filePath}`);
        continue;
      }

      const { name, description } = frontmatter;
      if (typeof name !== 'string' || typeof description !== 'string') {
        console.warn(`SkillLoader: missing or invalid name/description in ${filePath}`);
        continue;
      }

      // Normalize type and tags
      const type = typeof frontmatter.type === 'string' ? frontmatter.type.toLowerCase() : null;
      const tags = Array.isArray(frontmatter.tags)
        ? frontmatter.tags.map(t => String(t).toLowerCase())
        : [];

      const relativePath = path.relative(this.rootDir, filePath);
      metadata.push({
        path: relativePath.replace(/\\/g, '/'), // Use forward slashes for consistency.
        name,
        description,
        type,
        tags,
        frontmatter,
      });
    }

    return metadata;
  }

  /**
   * Returns a filtered list of skills that are considered "visible" for user selection.
   * Visible skills are those with type === 'skills'.
   * @returns {Promise<Array>} Array of visible skill objects, each containing:
   *   - path, name, description, type, tags (without the full frontmatter).
   */
  async getVisibleSkills() {
    const all = await this.loadSkillMetadata();

    const visible = all.filter(skill => {
      // Only include top-level skills. For backward compatibility accept
      // both `type: skill` (preferred) and `type: skills`.
      return skill.type === 'skill' || skill.type === 'skills';
    });

    // Return a minimal view for prompt injection / UI
    return visible.map(({ path, name, description, type, tags }) => ({
      path,
      name,
      description,
      type,
      tags,
    }));
  }
}

module.exports = SkillLoader;
