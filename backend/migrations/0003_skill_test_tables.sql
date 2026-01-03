-- Migration 0003: Skill Test Tables for Three-Test CAP Validation
-- This migration creates tables to store test responses and grading results for the skills framework MVP.

-- Store full test interactions
CREATE TABLE skill_test_responses (
    id SERIAL PRIMARY KEY,
    test_phase TEXT CHECK (test_phase IN ('baseline', 'discovery', 'compliance')),
    subtask_id TEXT NOT NULL,
    user_prompt TEXT NOT NULL,
    orion_response TEXT NOT NULL,
    response_metadata JSONB DEFAULT '{}'::jsonb, -- timing, token counts, tool calls, clarification flags
    created_at TIMESTAMP DEFAULT NOW()
);

-- Store Adam's grading results
CREATE TABLE skill_test_grades (
    id SERIAL PRIMARY KEY,
    response_id INTEGER REFERENCES skill_test_responses(id) ON DELETE CASCADE,
    
    -- Discovery score (-1 to +2) - only relevant for discovery/compliance phases
    discovery_score INTEGER,
    
    -- Compliance metrics (CAP steps 1-7) - only for compliance phase
    cap_steps_applied INTEGER[], -- which steps were applied (1-7)
    total_steps_applied INTEGER,
    
    -- Quality scores (1-5) - for all phases
    completeness_score INTEGER,
    depth_score INTEGER,
    constraint_count INTEGER,
    actionable_score INTEGER,
    
    -- Grading metadata
    grading_rationale TEXT,
    graded_by TEXT DEFAULT 'adam',
    graded_at TIMESTAMP DEFAULT NOW(),
    
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX idx_skill_test_responses_phase_subtask ON skill_test_responses (test_phase, subtask_id);
CREATE INDEX idx_skill_test_responses_created_at ON skill_test_responses (created_at);
CREATE INDEX idx_skill_test_grades_response_id ON skill_test_grades (response_id);
CREATE INDEX idx_skill_test_grades_graded_at ON skill_test_grades (graded_at);

-- Comments
COMMENT ON TABLE skill_test_responses IS 'Stores Orion responses for skill testing across three phases: baseline, discovery, compliance.';
COMMENT ON TABLE skill_test_grades IS 'Stores Adam grading results for skill test responses, including discovery, compliance, and quality scores.';
COMMENT ON COLUMN skill_test_responses.test_phase IS 'Test phase: baseline (no skills), discovery (skills in memory, natural prompt), compliance (skills in memory, forced prompt).';
COMMENT ON COLUMN skill_test_responses.response_metadata IS 'JSON metadata including timing, token counts, tool calls, and clarification flags.';
COMMENT ON COLUMN skill_test_grades.discovery_score IS 'Discovery score: -1 (non-compliance), 0 (superficial), +1 (effective compliance), +2 (spontaneous adoption). Only for discovery/compliance phases.';
COMMENT ON COLUMN skill_test_grades.cap_steps_applied IS 'Array of CAP steps (1-7) that were applied in the response.';
