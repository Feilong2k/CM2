# IntegrationReadinessService Specification

## Overview
`IntegrationReadinessService` validates whether a subtask's dependencies are fully integrated and ready before execution. It addresses the critical pain point where unit tests pass with mocks, but integration fails due to missing database schema, files, or services.

## Core Problem
```
Subtask 2-2-5 (unit tests) passes with mocks
↓
Subtask 2-2-6 (integration tests) fails because:
  - Database columns missing (external_id)
  - Filesystem permissions incorrect
  - External services unavailable
```

## Design Goals
1. **Early Failure Detection** – Catch integration issues before unit tests pass
2. **Clear Dependencies** – Explicit validation of what each subtask requires
3. **Orion Guidance** – Orion can identify missing dependencies and suggest fixes
4. **Progressive Disclosure** – Matches our skills framework philosophy

## Architecture

### Core Components

#### 1. IntegrationReadinessService Class
```javascript
// backend/src/services/IntegrationReadinessService.js
class IntegrationReadinessService {
  constructor(projectId) {
    this.projectId = projectId;
    this.validators = {
      database: new DatabaseValidator(),
      filesystem: new FilesystemValidator(),
      external: new ExternalServiceValidator()
    };
  }

  async validate(subtaskId, validationType = 'pre-integration') {
    // Returns readiness status with detailed results
  }
}
```

#### 2. Validator Interfaces
Each validator implements a standard interface:
```javascript
interface IValidator {
  async run(check): Promise<{
    success: boolean,
    message: string,
    details?: any,
    remediation?: string
  }>;
}
```

### Validation Categories

#### Database Validator
- **Columns Exist**: Verify required columns in tables
- **Migrations Applied**: Check specific migration versions
- **Foreign Key Integrity**: Validate referential integrity
- **Data Consistency**: Ensure test data exists when needed

#### Filesystem Validator
- **Paths Exist**: Verify required files and directories
- **Permissions**: Check read/write/execute permissions
- **File Contents**: Validate file headers, shebangs, or signatures
- **Size Limits**: Ensure files aren't too large for processing

#### External Service Validator
- **Service Health**: Ping databases, APIs, caches
- **Version Compatibility**: Check service versions match requirements
- **Authentication**: Validate credentials and tokens
- **Rate Limits**: Ensure usage within quotas

### Integration Points

#### 1. StepDecomposer Integration
```javascript
// Before creating steps, validate integration readiness
async decompose(subtaskId, decompositionJson) {
  const readiness = await this.integrationReadiness.validate(subtaskId);
  if (readiness.status !== 'ready') {
    throw new IntegrationNotReadyError(readiness.results);
  }
  // Proceed with decomposition
}
```

#### 2. Task Orchestrator Integration
```javascript
// Orion's workflow
class TaskOrchestrator {
  async executeSubtask(subtaskId) {
    // 1. Validate integration readiness
    const readiness = await this.integrationReadiness.validate(subtaskId);
    
    // 2. If not ready, provide Orion with remediation steps
    if (readiness.status !== 'ready') {
      return this.escalateToOrion(readiness);
    }
    
    // 3. Execute subtask
    return super.executeSubtask(subtaskId);
  }
}
```

## Configuration

### Validation Profiles
Different subtask types require different validation profiles:

```yaml
# validation_profiles.yaml
profiles:
  database_subtask:
    category: database
    checks:
      - type: columns_exist
        tables:
          - name: features
            columns: [id, external_id, title]
      - type: migrations_applied
        versions: [0001, 0002, 0003]
  
  filesystem_subtask:
    category: filesystem
    checks:
      - type: paths_exist
        paths: [backend/prompts/TaraPrompt.md]
      - type: permissions
        path: workspaces/
        required: write
  
  service_subtask:
    category: external
    checks:
      - type: service_health
        service: postgres
        timeout: 5000
```

### Subtask Metadata Extension
Each subtask definition includes integration requirements:
```json
{
  "subtask_id": "2-2-5",
  "integration_requirements": {
    "database": ["features.external_id", "steps.context_files"],
    "filesystem": ["backend/prompts/TaraPrompt.md"],
    "external": ["postgres:5432"]
  }
}
```

## Error Handling & Remediation

### Readiness Status
```javascript
{
  "subtaskId": "2-2-5",
  "status": "blocked", // ready, blocked, warning
  "timestamp": "2026-01-09T11:00:00Z",
  "results": [
    {
      "category": "database",
      "check": "columns_exist",
      "success": false,
      "message": "Column 'external_id' missing in table 'features'",
      "remediation": "Run migration 0002_step_enum_types.sql",
      "dependency": "2-1-2"
    }
  ]
}
```

### Orion Interaction Patterns
1. **Auto-Remediation**: Service attempts to fix issues (run migrations, create directories)
2. **Orion Guidance**: Provide clear instructions for Orion to resolve
3. **Human Escalation**: Block and notify human when automatic resolution fails

## Implementation Phases

### Phase 1: Core Service (MVP)
- Basic validators for database and filesystem
- Simple configuration via JSON
- Integration with StepDecomposer

### Phase 2: Advanced Validation
- External service validation
- Complex dependency graphs
- Performance optimization (caching, parallel validation)

### Phase 3: Intelligence & Auto-Remediation
- Machine learning for common failure patterns
- Automated fix suggestions and execution
- Integration with Skill Framework for complex remediation

## Success Metrics
1. **False Positive Rate**: <5% (unit tests pass but integration readiness fails)
2. **Validation Time**: <2 seconds for typical subtasks
3. **Remediation Success**: >80% of issues resolved automatically
4. **Developer Satisfaction**: Reduced integration headaches by 90%

## Dependencies
- Task 2-1: Database extensions (for schema validation)
- Task 2-2: Core helper services (for file validation)
- Task 2-3: Skills framework (for remediation skills)

## Risk Mitigation
- **Risk**: Overhead slows development
  - **Mitigation**: Async validation, intelligent caching
- **Risk**: False positives block progress
  - **Mitigation**: Conservative validation, manual override
- **Risk**: Complex configuration
  - **Mitigation**: Auto-generated profiles, sensible defaults

## Integration with Existing Workflow

### Updated Subtask Lifecycle
```
Original: Planning → Unit Tests → Integration Tests → Done
Updated:  Planning → Integration Readiness → Unit Tests → Integration Tests → Done
```

### Orion's Enhanced Capabilities
1. **Predictive Blockers**: Orion can warn about integration issues before subtask assignment
2. **Smart Sequencing**: Orion can reorder subtasks based on dependency readiness
3. **Remediation Skills**: Orion can execute skills to fix integration gaps

## Conclusion
`IntegrationReadinessService` transforms our workflow from "unit tests pass → integration surprise" to "integration readiness → unit tests → integration success." It directly addresses the pain points you've experienced while maintaining our architectural principles of separation of concerns and progressive disclosure.

**Next Step**: Implementation plan and subtask breakdown.