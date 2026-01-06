-- Migration: 0004_work_stages_table.sql
-- Description: Create work_stages table for tracking feature/task progression with optional foreign keys.
-- Dependencies: 0002_step_enum_types.sql (ENUM type work_stage must exist)
-- Task: 2-1-3 Create work_stages Table

-- Create work_stages table
CREATE TABLE IF NOT EXISTS work_stages (
    id SERIAL PRIMARY KEY,
    stage work_stage NOT NULL,
    feature_id INTEGER REFERENCES features(id) ON DELETE SET NULL,
    task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_work_stages_feature_id ON work_stages(feature_id);
CREATE INDEX IF NOT EXISTS idx_work_stages_task_id ON work_stages(task_id);
CREATE INDEX IF NOT EXISTS idx_work_stages_stage ON work_stages(stage);
CREATE INDEX IF NOT EXISTS idx_work_stages_created_at ON work_stages(created_at);

-- Add table comment
COMMENT ON TABLE work_stages IS 'Tracks progression stages for features and tasks with optional relationships';
