-- Migration: 0006_fix_steps_table.sql
-- Description: Recreate steps table with correct schema and fix project relationship
-- This migration should be run after 0005_projects_table.sql

-- Drop existing steps table if it exists (will be recreated with correct schema)
DROP TABLE IF EXISTS steps CASCADE;

-- Recreate steps table with correct schema matching DatabaseTool expectations
CREATE TABLE steps (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    subtask_id INTEGER NOT NULL REFERENCES subtasks(id) ON DELETE CASCADE,
    step_number INTEGER NOT NULL,
    step_type step_type NOT NULL,
    assigned_to assigned_to NOT NULL,
    file_path TEXT,
    instructions TEXT NOT NULL,
    status status DEFAULT 'pending' NOT NULL,
    context_files JSONB DEFAULT '[]' NOT NULL,
    attempt_count INTEGER DEFAULT 0,
    last_error TEXT,
    parent_step_id INTEGER REFERENCES steps(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure step_number is positive
    CONSTRAINT steps_step_number_positive CHECK (step_number > 0),
    -- Ensure attempt_count is non-negative
    CONSTRAINT steps_attempt_count_non_negative CHECK (attempt_count >= 0)
);

-- Create indexes for performance
CREATE INDEX idx_steps_subtask_id ON steps(subtask_id);
CREATE INDEX idx_steps_project_id ON steps(project_id);
CREATE INDEX idx_steps_status ON steps(status);
CREATE INDEX idx_steps_step_type ON steps(step_type);
CREATE INDEX idx_steps_assigned_to ON steps(assigned_to);
CREATE INDEX idx_steps_parent_step_id ON steps(parent_step_id);
CREATE INDEX idx_steps_created_at ON steps(created_at);
CREATE INDEX idx_steps_updated_at ON steps(updated_at);

-- Create unique constraint for step numbers within a subtask
CREATE UNIQUE INDEX idx_steps_subtask_step_number ON steps(subtask_id, step_number);

-- Add table comment
COMMENT ON TABLE steps IS 'Tracks individual workflow steps within subtasks';