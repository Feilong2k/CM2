# Feature 2 Database Schema (Task & Subtask System)

## Overview
Feature 2 implements the hierarchical task management system (Projects -> Features -> Tasks -> Subtasks) within the Orion platform.

## Tables

### 1. `projects`
Top-level container for all work.
- `id` (PK): integer, auto-increment
- `external_id`: string (e.g., 'P1')
- `name`: string
- `description`: text
- `path`: string (local filesystem path)
- `git_url`: string
- `status`: enum ('active', 'archived')
- `created_at`, `updated_at`

### 2. `features`
Major functional areas within a project.
- `id` (PK): integer, auto-increment
- `project_id` (FK): references projects(id)
- `external_id`: string (e.g., 'P1-F2')
- `title`: string
- `status`: enum ('pending', 'in_progress', 'completed', 'blocked')
- `basic_info`: jsonb
- `pcc`: jsonb (Project Context Checklist)
- `cap`: jsonb (Constraint-Aware Planning)
- `red`: jsonb (Requirement Engineering Definition)
- `created_at`, `updated_at`

### 3. `tasks`
Specific units of work within a feature.
- `id` (PK): integer, auto-increment
- `feature_id` (FK): references features(id)
- `external_id`: string (e.g., 'P1-F2-T1')
- `title`: string
- `status`: enum ('pending', 'in_progress', 'completed', 'blocked')
- `basic_info`: jsonb
- `pcc`: jsonb
- `cap`: jsonb
- `created_at`, `updated_at`

### 4. `subtasks`
Atomic implementation steps.
- `id` (PK): integer, auto-increment
- `task_id` (FK): references tasks(id)
- `external_id`: string (e.g., 'P1-F2-T1-S1')
- `title`: string
- `status`: enum ('pending', 'in_progress', 'completed', 'blocked')
- `workflow_stage`: enum ('planning', 'development', 'testing', 'review')
- `basic_info`: jsonb
- `instruction`: jsonb (prompt for Tara)
- `pcc`: jsonb
- `tests`: jsonb (test files/specs)
- `implementation`: jsonb (changed files)
- `review`: jsonb (review feedback)
- `created_at`, `updated_at`

## Relationships
- One Project has many Features
- One Feature has many Tasks
- One Task has many Subtasks

## Key Constraints
- `external_id` must be unique across the system.
- `project_id`, `feature_id`, `task_id` are mandatory FKs.
- Status transitions are logged in `activity_log` (separate table).
