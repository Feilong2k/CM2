const { query } = require('../../../src/db/connection');

/**
 * Ensures the Feature 2 test data hierarchy exists in the database:
 * - Feature P1‑F2
 * - Tasks P1‑F2‑T1 and P1‑F2‑T2 (linked to the feature)
 * - 12 subtasks (2‑1‑1 … 2‑1‑6, 2‑2‑1 … 2‑2‑6) linked to the respective tasks
 *
 * The function is idempotent: repeated calls do not create duplicates.
 */
async function setupFeature2TestData() {
  // 1. Ensure Feature P1‑F2 exists
  let featureResult = await query(
    `SELECT * FROM features WHERE external_id = $1`,
    ['P1-F2']
  );

  if (featureResult.rows.length === 0) {
    featureResult = await query(
      `INSERT INTO features (external_id, title, status, project_id, basic_info, order_index)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        'P1-F2',
        'Feature 2: Skills Framework MVP',
        'active',
        'P1',
        JSON.stringify({ description: 'MVP of the skills framework for CM2' }),
        0
      ]
    );
    console.log('Created feature P1-F2');
  } else {
    // Optionally update if needed
    await query(
      `UPDATE features 
       SET title = $1, status = $2, project_id = $3, basic_info = $4, order_index = $5
       WHERE external_id = $6`,
      [
        'Feature 2: Skills Framework MVP',
        'active',
        'P1',
        JSON.stringify({ description: 'MVP of the skills framework for CM2' }),
        0,
        'P1-F2'
      ]
    );
    console.log('Updated feature P1-F2');
  }

  const feature = featureResult.rows[0];

  // 2. Ensure Tasks P1‑F2‑T1 and P1‑F2‑T2
  const taskExternalIds = ['P1-F2-T1', 'P1-F2-T2'];
  const taskTitles = {
    'P1-F2-T1': 'Task 1: Skill Loader & Context Integration',
    'P1-F2-T2': 'Task 2: CAP Probe & Skill Test Framework'
  };

  const tasks = [];

  for (const externalId of taskExternalIds) {
    let taskResult = await query(
      `SELECT * FROM tasks WHERE external_id = $1`,
      [externalId]
    );

    if (taskResult.rows.length === 0) {
      taskResult = await query(
        `INSERT INTO tasks (external_id, title, status, feature_id, basic_info, order_index)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          externalId,
          taskTitles[externalId],
          'active',
          feature.id,
          JSON.stringify({}),
          0
        ]
      );
      console.log(`Created task ${externalId}`);
    } else {
      // Update if needed
      await query(
        `UPDATE tasks 
         SET title = $1, status = $2, feature_id = $3, basic_info = $4, order_index = $5
         WHERE external_id = $6`,
        [
          taskTitles[externalId],
          'active',
          feature.id,
          JSON.stringify({}),
          0,
          externalId
        ]
      );
      console.log(`Updated task ${externalId}`);
      taskResult = await query(
        `SELECT * FROM tasks WHERE external_id = $1`,
        [externalId]
      );
    }

    tasks.push(taskResult.rows[0]);
  }

  // 3. Ensure Subtasks for each task (with cleanup of old subtasks)
  const subtaskDefinitions = [
    // Task T1 subtasks - convert shorthand to full external IDs
    { taskExternalId: 'P1-F2-T1', externalIds: ['P1-F2-T1-S1', 'P1-F2-T1-S2', 'P1-F2-T1-S3', 'P1-F2-T1-S4', 'P1-F2-T1-S5', 'P1-F2-T1-S6'] },
    // Task T2 subtasks - convert shorthand to full external IDs
    { taskExternalId: 'P1-F2-T2', externalIds: ['P1-F2-T2-S1', 'P1-F2-T2-S2', 'P1-F2-T2-S3', 'P1-F2-T2-S4', 'P1-F2-T2-S5', 'P1-F2-T2-S6'] }
  ];

  // Map task external ID to task object
  const taskMap = {};
  tasks.forEach(t => { taskMap[t.external_id] = t; });

  for (const def of subtaskDefinitions) {
    const task = taskMap[def.taskExternalId];

    // Upsert each expected subtask
    for (const externalId of def.externalIds) {
      let subtaskResult = await query(
        `SELECT * FROM subtasks WHERE external_id = $1`,
        [externalId]
      );

      if (subtaskResult.rows.length === 0) {
        // Create subtask
        await query(
          `INSERT INTO subtasks (external_id, title, status, task_id, basic_info, instruction, order_index, workflow_stage)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            externalId,
            `Subtask ${externalId}`,
            'pending',
            task.id,
            JSON.stringify({}),
            JSON.stringify({}),
            0,
            'planning'
          ]
        );
        console.log(`Created subtask ${externalId}`);
      } else {
        // Update if needed (ensure task_id matches)
        await query(
          `UPDATE subtasks 
           SET title = $1, status = $2, task_id = $3, basic_info = $4, instruction = $5, order_index = $6, workflow_stage = $7
           WHERE external_id = $8`,
          [
            `Subtask ${externalId}`,
            'pending',
            task.id,
            JSON.stringify({}),
            JSON.stringify({}),
            0,
            'planning',
            externalId
          ]
        );
        console.log(`Updated subtask ${externalId}`);
      }
    }

    // Cleanup: delete any subtasks for this task that are not in the expected list
    const placeholders = def.externalIds.map((_, i) => `$${i+1}`).join(',');
    const deleteQuery = `
      DELETE FROM subtasks 
      WHERE task_id = $${def.externalIds.length + 1}
        AND external_id NOT IN (${placeholders})
    `;
    const deleteParams = [...def.externalIds, task.id];
    const deleteResult = await query(deleteQuery, deleteParams);
    if (deleteResult.rowCount > 0) {
      console.log(`Deleted ${deleteResult.rowCount} old/unexpected subtasks for task ${def.taskExternalId}`);
    }
  }
}

/**
 * CLI entry point (optional) – allows running the script directly.
 */
async function main() {
  try {
    await setupFeature2TestData();
    console.log('Feature 2 test data ready');
  } catch (err) {
    console.error('Seeding failed:', err);
    process.exitCode = 1;
  } finally {
    const { closePool } = require('../../../src/db/connection');
    await closePool();
  }
}

if (require.main === module) {
  main();
}

module.exports = { setupFeature2TestData };
