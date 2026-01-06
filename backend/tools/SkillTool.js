/**
 * SkillTool - Execute protocol skills from the skills framework
 * 
 * This tool allows Orion to execute skills (protocols) as tools while orchestrating subtasks.
 */

const fs = require('fs').promises;
const path = require('path');
const yaml = require('js-yaml');
const { query } = require('./DatabaseTool');
const SkillLoader = require('../src/skills/SkillLoader');

/**
 * Extract frontmatter and body from SKILL.md content
 */
function extractFrontmatterAndBody(content) {
  const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n/;
  const match = content.match(frontmatterRegex);
  if (!match) {
    return { frontmatter: null, body: content };
  }
  const frontmatter = yaml.load(match[1]);
  const body = content.slice(match[0].length);
  return { frontmatter, body };
}

/**
 * Validate parameters against skill definitions and apply defaults.
 * @param {object} providedParams - Parameters provided by caller
 * @param {object} paramDefinitions - Parameter definitions from skill frontmatter
 * @returns {object} Merged parameters with defaults applied
 * @throws {Error} If required parameter is missing
 */
function validateAndApplyDefaults(providedParams, paramDefinitions) {
  const merged = { ...providedParams };

  // If no parameter definitions, return provided params as-is
  if (!paramDefinitions || typeof paramDefinitions !== 'object') {
    return merged;
  }

  for (const [paramName, paramDef] of Object.entries(paramDefinitions)) {
    const hasValue = paramName in providedParams;

    // Check required parameters
    if (paramDef.required && !hasValue) {
      throw new Error(`Required parameter "${paramName}" is missing`);
    }

    // Apply default values
    if (!hasValue && paramDef.default !== undefined) {
      merged[paramName] = paramDef.default;
    }
  }

  return merged;
}

/**
 * Execute a skill by name (MVP = load and return definition).
 * @param {{ skill_name: string, parameters?: object, execute?: boolean }} args
 * @param {function} traceEmitter - Optional trace emitter function
 * @returns {Promise<object>}
 */
async function executeSkill(args, traceEmitter = null) {
  const { skill_name, parameters = {}, execute = false } = args || {};
  const startTime = Date.now();

  // Helper to emit trace if emitter exists
  const emit = (event) => traceEmitter && traceEmitter(event);

  try {
    if (!skill_name || typeof skill_name !== 'string') {
      throw new Error('SkillTool_execute: skill_name is required and must be a string.');
    }

    // Use SkillLoader to find the skill
    const loader = new SkillLoader(); // defaults to backend/Skills
    const all = await loader.loadSkillMetadata();

    // Find by name (case-insensitive)
    const skill = all.find(
      (s) => s.name.toLowerCase() === skill_name.toLowerCase()
    );

    if (!skill) {
      throw new Error(`SkillTool_execute: skill "${skill_name}" not found.`);
    }

    // Emit start trace (after we know skill_name is valid)
    emit({
      type: 'skill_execution_start',
      skill_name: skill_name,
      parameters: parameters,
      timestamp: new Date().toISOString()
    });

    const skillPath = path.join(loader.rootDir, skill.path);
    const content = await fs.readFile(skillPath, 'utf8');
    const { frontmatter, body } = extractFrontmatterAndBody(content);

    // If execute flag is true, run execution logic
    if (execute) {
      const mergedParams = validateAndApplyDefaults(parameters, frontmatter?.parameters);

      // Emit end trace on success
      const outputPreview = body.length > 500 ? body.slice(0, 500) : body;
      emit({
        type: 'skill_execution_end',
        skill_name: skill.name,
        duration_ms: Date.now() - startTime,
        output_chars: body.length,
        output_preview: outputPreview,
        success: true
      });

      return {
        skill_name: skill.name,
        path: skill.path,
        frontmatter: frontmatter || skill.frontmatter || {},
        body,
        parameters: mergedParams,
        executed: true,
        execution_result: {
          success: true,
          parameters_received: mergedParams,
          instructions_processed: true,
        },
      };
    }

    // Default: return definition only (backward compatible)
    return {
      skill_name: skill.name,
      path: skill.path,
      frontmatter: frontmatter || skill.frontmatter || {},
      body,               // markdown instructions without frontmatter
      parameters,         // echo back what caller passed
    };
  } catch (error) {
    // Emit fail trace
    emit({
      type: 'skill_execution_fail',
      skill_name: skill_name,
      error: error.message,
      duration_ms: Date.now() - startTime
    });
    throw error;
  }
}

class SkillTool {
  /**
   * Execute a skill by name
   * @param {string} skillName - Name or external_id of the skill to execute
   * @param {Object} inputs - Input parameters for the skill
   * @param {string} subtaskId - Optional subtask ID for tracking
   * @returns {Object} Skill execution results
   */
  async executeSkill(skillName, inputs, subtaskId = null) {
    try {
      const startTime = Date.now();
      
      // Get the skill definition
      const skill = await this.getSkill(skillName);
      if (!skill) {
        throw new Error(`Skill not found: ${skillName}`);
      }
      
      // Validate inputs against schema
      this.validateInputs(inputs, skill.input_schema);
      
      // Execute the skill (for now, we'll return a structured analysis)
      // In a real implementation, this would execute the actual protocol logic
      const outputs = await this.executeSkillLogic(skill, inputs);
      
      // Record the execution
      const executionTime = Date.now() - startTime;
      await this.recordExecution(skill.id, subtaskId, inputs, outputs, executionTime);
      
      return {
        success: true,
        skill: skill.name,
        version: skill.version,
        outputs,
        execution_time_ms: executionTime
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        skill: skillName
      };
    }
  }
  
  /**
   * Get skill definition from database
   */
  async getSkill(skillName) {
    const result = await query(
      `SELECT * FROM skills 
       WHERE external_id = $1 OR name ILIKE $2 
       ORDER BY version DESC LIMIT 1`,
      [skillName, `%${skillName}%`]
    );
    
    return result.rows[0] || null;
  }
  
  /**
   * Validate inputs against skill schema
   */
  validateInputs(inputs, schema) {
    // Basic validation - in production, use JSON schema validation
    if (!inputs || typeof inputs !== 'object') {
      throw new Error('Inputs must be an object');
    }
    
    // Check required fields if schema is defined
    if (schema && schema.required) {
      for (const field of schema.required) {
        if (!(field in inputs)) {
          throw new Error(`Missing required input: ${field}`);
        }
      }
    }
  }
  
  /**
   * Execute skill logic based on skill type
   */
  async executeSkillLogic(skill, inputs) {
    // For CAP skill, perform constraint aware planning
    if (skill.name.includes('CAP') || skill.name.includes('Constraint Aware Planning')) {
      return this.executeCAPSkill(inputs);
    }
    
    // Default: return skill steps with inputs
    return {
      skill_executed: skill.name,
      steps: skill.execution_steps,
      inputs_received: inputs,
      timestamp: new Date().toISOString()
    };
  }
  
  /**
   * Execute CAP skill logic
   */
  async executeCAPSkill(inputs) {
    const { plan, goal, context = {} } = inputs;
    
    // This is a simplified implementation
    // In production, this would execute the full 7-step CAP protocol
    return {
      verified_plan: {
        original_plan: plan,
        goal_alignment: `Plan appears to align with goal: "${goal}"`,
        completeness_check: "PENDING - Requires full CAP execution"
      },
      test_specifications: [
        "Test 1: Verify plan achieves stated goal",
        "Test 2: Validate all dependencies are accounted for",
        "Test 3: Ensure integration points are testable"
      ],
      identified_gaps: [
        "Gap analysis requires full CAP step 3 execution",
        "Dependency mapping requires step 4 execution"
      ],
      dependency_graph: {
        status: "PENDING - Requires step 4 execution"
      },
      completeness_check: false,
      next_steps: [
        "Complete CAP step 3: Identify gaps & map data flow",
        "Complete CAP step 4: Map dependencies",
        "Complete CAP step 5: Check integration",
        "Complete CAP step 6: Validate test seams",
        "Complete CAP step 7: Define verification tests"
      ]
    };
  }
  
  /**
   * Record skill execution in database
   */
  async recordExecution(skillId, subtaskId, inputs, outputs, executionTime) {
    await query(
      `INSERT INTO skill_executions 
       (skill_id, subtask_id, inputs, outputs, execution_time_ms, status)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        skillId,
        subtaskId,
        JSON.stringify(inputs),
        JSON.stringify(outputs),
        executionTime,
        'completed'
      ]
    );
  }
  
  /**
   * List available skills
   */
  async listSkills(tags = null) {
    let queryStr = 'SELECT external_id, name, description, tags, complexity FROM skills';
    const params = [];
    
    if (tags && tags.length > 0) {
      queryStr += ' WHERE tags @> $1';
      params.push(JSON.stringify(tags));
    }
    
    queryStr += ' ORDER BY name';
    
    const result = await query(queryStr, params);
    return result.rows;
  }
  
  /**
   * Get skill execution history
   */
  async getExecutionHistory(skillId = null, subtaskId = null, limit = 10) {
    let queryStr = `
      SELECT se.*, s.name as skill_name, s.external_id as skill_external_id
      FROM skill_executions se
      JOIN skills s ON se.skill_id = s.id
    `;
    
    const conditions = [];
    const params = [];
    
    if (skillId) {
      conditions.push(`se.skill_id = $${params.length + 1}`);
      params.push(skillId);
    }
    
    if (subtaskId) {
      conditions.push(`se.subtask_id = $${params.length + 1}`);
      params.push(subtaskId);
    }
    
    if (conditions.length > 0) {
      queryStr += ' WHERE ' + conditions.join(' AND ');
    }
    
    queryStr += ' ORDER BY se.created_at DESC LIMIT $' + (params.length + 1);
    params.push(limit);
    
    const result = await query(queryStr, params);
    return result.rows;
  }
}

module.exports = {
  executeSkill,
  SkillTool
};
