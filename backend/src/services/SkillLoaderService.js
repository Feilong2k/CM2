const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

class SkillLoaderService {
  constructor(skillsBasePath = null) {
    // Default to backend/Skills relative to this file
    this.skillsBasePath = skillsBasePath || path.join(__dirname, '../../Skills');
  }

  /**
   * Scan the skills directory and load all skills
   * @returns {Object} Map of skill names to skill data (YAML frontmatter and markdown body)
   */
  loadAllSkills() {
    const skills = {};
    
    // Check if skills directory exists
    if (!fs.existsSync(this.skillsBasePath)) {
      console.warn(`Skills directory not found: ${this.skillsBasePath}`);
      return skills;
    }

    // List all directories in the skills base path
    const skillFolders = fs.readdirSync(this.skillsBasePath, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);

    for (const folderName of skillFolders) {
      const skillPath = path.join(this.skillsBasePath, folderName, 'SKILL.md');
      
      if (fs.existsSync(skillPath)) {
        try {
          const skillData = this.loadSkillFromFile(skillPath);
          if (skillData) {
            skills[skillData.name] = skillData;
          }
        } catch (error) {
          console.error(`Error loading skill from ${skillPath}:`, error.message);
        }
      }
    }

    return skills;
  }

  /**
   * Load a single skill from a SKILL.md file with YAML frontmatter
   * @param {string} filePath - Path to SKILL.md
   * @returns {Object|null} Skill data or null if error
   */
  loadSkillFromFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Parse YAML frontmatter (format: ---\nYAML\n---\nMarkdown)
    const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
    const match = content.match(frontmatterRegex);
    
    if (!match) {
      throw new Error(`Invalid SKILL.md format: missing YAML frontmatter in ${filePath}`);
    }

    const yamlContent = match[1];
    const markdownBody = match[2].trim();

    try {
      const frontmatter = yaml.load(yamlContent);
      
      // Validate required fields
      if (!frontmatter.name) {
        throw new Error('Skill missing required "name" field in YAML frontmatter');
      }

      return {
        ...frontmatter,
        body: markdownBody,
        filePath
      };
    } catch (yamlError) {
      throw new Error(`Failed to parse YAML frontmatter in ${filePath}: ${yamlError.message}`);
    }
  }

  /**
   * Get a specific skill by name
   * @param {string} skillName - Name of the skill to retrieve
   * @returns {Object|null} Skill data or null if not found
   */
  getSkill(skillName) {
    const allSkills = this.loadAllSkills();
    return allSkills[skillName] || null;
  }

  /**
   * Generate a formatted prompt section for a skill
   * @param {Object} skill - Skill data object
   * @returns {string} Formatted skill section for inclusion in prompt
   */
  formatSkillForPrompt(skill) {
    // Use the YAML frontmatter for metadata and the body for detailed instructions
    return `## ${skill.name} Skill\n\n` +
           `**Description:** ${skill.description || 'No description'}\n\n` +
           `**Decision Triggers:**\n${(skill.decision_triggers || []).map(t => `- ${t}`).join('\n')}\n\n` +
           `**Skill Content:**\n${skill.body}\n\n` +
           `---\n\n`;
  }

  /**
   * Generate a concise skills summary (just frontmatter) for quick reference
   * @param {Object} skill - Skill data object
   * @returns {string} Concise skill summary
   */
  formatSkillSummary(skill) {
    return `**${skill.name}** (v${skill.version || '1.0.0'}): ${skill.description || ''}\n` +
           `Decision triggers: ${(skill.decision_triggers || []).slice(0, 2).join(', ')}${skill.decision_triggers && skill.decision_triggers.length > 2 ? '...' : ''}`;
  }

  /**
   * Generate a complete skills section for the system prompt
   * @param {Array<string>} skillNames - Optional list of skill names to include (if empty, include all)
   * @returns {string} Complete skills section for prompt
   */
  generateSkillsPromptSection(skillNames = null) {
    const allSkills = this.loadAllSkills();
    
    // Filter skills if specific names are provided
    let skillsToInclude = allSkills;
    if (skillNames && Array.isArray(skillNames)) {
      skillsToInclude = {};
      for (const name of skillNames) {
        if (allSkills[name]) {
          skillsToInclude[name] = allSkills[name];
        }
      }
    }

    // Filter to only include top-level skills (type === 'skill'), exclude subskills
    const topLevelSkills = {};
    for (const [skillName, skillData] of Object.entries(skillsToInclude)) {
      if (skillData.type === 'skill') {
        topLevelSkills[skillName] = skillData;
      }
    }

    // If no top-level skills, return empty string
    if (Object.keys(topLevelSkills).length === 0) {
      return '';
    }

    // Generate the section with summaries only (no full protocol bodies)
    let section = '# Available Skills\n\n';
    
    for (const [skillName, skillData] of Object.entries(topLevelSkills)) {
      section += `- ${this.formatSkillSummary(skillData)}\n`;
    }

    section += '\n';
    
    return section;
  }
}

module.exports = SkillLoaderService;
