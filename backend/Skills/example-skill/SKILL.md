---
name: example-skill
description: A simple example skill for testing execution
type: skill
parameters:
  greeting:
    type: string
    required: true
    description: The greeting message to use
  count:
    type: number
    default: 1
    description: Number of times to repeat
---

# Example Skill

This skill demonstrates basic execution.

## Instructions

1. Take the `greeting` parameter
2. Repeat it `count` times
3. Return the result

## Expected Output

The skill should return a structured result containing:
- The greeting repeated `count` times
- A success status
- Execution metadata

