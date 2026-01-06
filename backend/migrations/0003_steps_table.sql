-- Migration: 0003_steps_table.sql
-- Description: Create steps table for tracking individual workflow steps
-- Dependencies: 0002_step_enum_types.sql (ENUM types must exist)
-- Task: 2-1-2 Create steps Table

-- Create steps table
CREATE TABLE IF NOT EXISTS steps (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id),
    subtask_id INTEGER NOT NULL REFERENCES subtasks(id),
    step_number INTEGER NOT NULL,
    step_type step_type NOT NULL,
    file_path TEXT,
    instructions TEXT,
    status status NOT NULL,
    assigned_to assigned_to NOT NULL,
    context_snapshot JSON,
    context_files JSONB,
    attempt_count INTEGER DEFAULT 0,
    last_error TEXT,
    parent_step_id INTEGER REFERENCES steps(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_steps_subtask_id ON steps(subtask_id);
CREATE INDEX IF NOT EXISTS idx_steps_project_id ON steps(project_id);
CREATE INDEX IF NOT EXISTS idx_steps_status ON steps(status);
CREATE INDEX IF NOT EXISTS idx_steps_parent_step_id ON steps(parent_step_id);
CREATE INDEX IF NOT EXISTS idx_steps_created_at ON steps(created_at);

-- Add table comment
COMMENT ON TABLE steps IS 'Tracks individual workflow steps within subtasks';

