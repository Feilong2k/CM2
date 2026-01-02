-- Migration 0002: Create PostgreSQL ENUM types for step management
-- For Feature 2: Autonomous TDD Workflow with Aider Integration
-- Subtask: 2-1-1 Create PostgreSQL ENUM Types

-- ENUM: step_type - Type of work step (implementation vs test)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'step_type') THEN
        CREATE TYPE step_type AS ENUM (
            'implementation',  -- Code implementation step
            'test'            -- Test creation/execution step
        );
    END IF;
END$$;

-- ENUM: status - Current status of a step
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'status') THEN
        CREATE TYPE status AS ENUM (
            'pending',      -- Not yet started
            'in_progress',  -- Currently being worked on
            'completed',    -- Successfully finished
            'failed'        -- Failed during execution
        );
    END IF;
END$$;

-- ENUM: assigned_to - Which Aider agent is responsible
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'assigned_to') THEN
        CREATE TYPE assigned_to AS ENUM (
            'TaraAider',   -- Responsible for test creation/execution
            'DevonAider'   -- Responsible for implementation
        );
    END IF;
END$$;

-- ENUM: work_stage - Overall progression stage for feature/task
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'work_stage') THEN
        CREATE TYPE work_stage AS ENUM (
            'pending',                    -- Initial state
            'analysis',                   -- Requirements analysis
            'unit_testing',               -- Unit test creation (Tara)
            'unit_implementation',        -- Unit code implementation (Devon)
            'integration_testing',        -- Integration test creation (Tara)
            'integration_implementation', -- Integration code implementation (Devon)
            'review',                     -- Code review and validation
            'completed'                   -- Feature/task complete
        );
    END IF;
END$$;

-- Optional: Add comments to system catalog
COMMENT ON TYPE step_type IS 'Type of work step: implementation or test creation';
COMMENT ON TYPE status IS 'Current status of a step: pending, in_progress, completed, failed';
COMMENT ON TYPE assigned_to IS 'Aider agent responsible: TaraAider (tests) or DevonAider (implementation)';
COMMENT ON TYPE work_stage IS 'Overall work stage for feature/task progression';
