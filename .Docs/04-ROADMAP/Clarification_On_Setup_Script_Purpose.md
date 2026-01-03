# Clarification: Setup Script Purpose and Content

## Issue Identified
There was confusion in the test specification about what content the setup script should create in the database subtasks.

## Original Question
"Why did you have must contain 'Devon Instructions from v5 Spec'? when we are asking Orion to create the prompts for Tara?"

## Answer

### 1. **Correct Understanding**
The setup script (`backend/scripts/probes/tdd/setup_test_data.js`) should create **Feature 2 subtasks in the database** with content from the v5 specification. This content includes:
- **Title**: The subtask title (e.g., "Create PostgreSQL ENUM types for step management")
- **Basic Info**: The description from the v5 spec
- **Instruction**: The detailed requirements that Orion will use to generate Tara prompts

### 2. **Role Clarification**
- **Devon**: Implements the setup script (creates database entries)
- **Tara**: Tests that the setup script works correctly
- **Orion**: Uses the subtask content (created by setup script) to generate prompts for Tara
- **Adam**: Designs the system

### 3. **Content Source**
The subtask content should come from `.Docs/00-INBOX/Feature2_Skills_Aider_Integration_v5.md`, specifically:
- **Subtask Descriptions** (not "Devon Instructions")
- **Acceptance Criteria** 
- **Implementation requirements** (which Orion will interpret)

### 4. **Correction Needed**
The test specification should verify that subtasks contain the **v5 specification content**, not specifically "Devon Instructions". The content should be what Orion needs to generate proper Tara prompts.

## Updated Approach

### For Devon (Implementation):
Create subtasks with this structure:
```javascript
{
  title: "Create PostgreSQL ENUM types for step management",
  basic_info: "Create PostgreSQL ENUM types for step management: step_type, status, assigned_to, work_stage.",
  instruction: "Detailed requirements from v5 spec that Orion will use"
}
```

### For Tara (Testing):
Verify that subtask content matches the v5 specification exactly, so Orion has accurate information to work with.

### For Orion (Usage):
Will read these subtasks and generate appropriate prompts for Tara based on the content.

## Next Steps
1. **Update test specification** to remove "Devon Instructions" reference
2. **Clarify** that content should be the v5 spec subtask descriptions
3. **Proceed** with implementation as planned

## Confirmation Needed
Is this understanding correct? The setup script creates database entries with v5 spec content that Orion will use, not specifically "Devon instructions".
