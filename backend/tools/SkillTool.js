/**
 * SkillTool - Execute protocol skills from the skills framework
 * 
 * This tool allows Orion to execute skills (protocols) as tools while orchestrating subtasks.
 */

const { query } = require('./DatabaseTool');

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

module.exports = SkillTool;