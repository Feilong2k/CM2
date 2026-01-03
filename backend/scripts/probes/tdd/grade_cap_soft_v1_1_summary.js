// Simple grading/summary script for v1.1 soft-compliance CAP probe results.
// This script only looks at rows with test_phase='compliance' and cap_prompt_mode='soft_v1_1'.

const { query, closePool } = require('../../../src/db/connection');

async function fetchLatestSoftCompliance() {
  const res = await query(
    `SELECT id, test_phase, subtask_id, user_prompt, orion_response, response_metadata, created_at
     FROM skill_test_responses
     WHERE test_phase = 'compliance'
       AND response_metadata->>'cap_prompt_mode' = 'soft_v1_1'
     ORDER BY subtask_id, created_at`
  );

  const latest = new Map(); // key: subtask_id -> row

  for (const row of res.rows) {
    const key = row.subtask_id;
    // since we ordered by created_at ascending, later rows overwrite earlier ones
    latest.set(key, row);
  }

  return Array.from(latest.values());
}

function detectCapSteps(text) {
  const lc = (text || '').toLowerCase();
  const steps = [];
  for (let i = 1; i <= 7; i++) {
    if (lc.includes(`step ${i}`)) {
      steps.push(i);
    }
  }
  return steps;
}

function detectSpontaneousCap(text) {
  const lc = (text || '').toLowerCase();
  return (
    lc.includes('constraint-aware planning') ||
    lc.includes('cap skill') ||
    lc.includes('cap protocol') ||
    // loose heuristic: references to "step 1" and "step 2" together
    (lc.includes('step 1') && lc.includes('step 2'))
  );
}

function approximateQualityScores(text) {
  const lc = (text || '').toLowerCase();
  const len = text ? text.length : 0;

  // Completeness: based loosely on length and presence of multiple sections
  let completeness = 2;
  if (len > 800) completeness = 3;
  if (len > 2000) completeness = 4;
  if (len > 5000 && (lc.includes('tests') || lc.includes('edge case'))) completeness = 5;

  // Depth: look for reasoning indicators
  let depth = 2;
  let signals = 0;
  if (lc.includes('dependency') || lc.includes('dependencies')) signals++;
  if (lc.includes('assumption')) signals++;
  if (lc.includes('failure') || lc.includes('fallback')) signals++;
  if (lc.includes('integration')) signals++;
  if (signals >= 3) depth = 4;
  else if (signals >= 1) depth = 3;

  // Actionable: look for explicit testing instructions
  let actionable = 2;
  if (lc.includes('tara') && lc.includes('test')) actionable = 3;
  if (lc.includes('steps to test') || lc.includes('verify that')) actionable = 4;
  if (lc.includes('success criteria') || lc.includes('pass when')) actionable = 5;

  // Constraint count: count distinct constraint keywords
  const constraintKeywords = [
    'database',
    'migration',
    'performance',
    'latency',
    'throughput',
    'memory',
    'security',
    'rate limit',
    'limit ',
    'dependency',
  ];
  let constraintCount = 0;
  for (const kw of constraintKeywords) {
    if (lc.includes(kw)) constraintCount++;
  }

  return { completeness, depth, actionable, constraintCount };
}

async function main() {
  const softComplianceRows = await fetchLatestSoftCompliance();

  let effectiveCount = 0;
  let capUsedCount = 0;
  let pcc1UsedCount = 0;  // Track PCC1 usage explicitly
  const capStepsPerSubtask = [];

  for (const row of softComplianceRows) {
    const text = row.orion_response || '';
    const lc = text.toLowerCase();

    // Effective CAP: >=3 numbered steps
    const steps = detectCapSteps(text);
    capStepsPerSubtask.push({ 
        subtask_id: row.subtask_id, 
        stepCount: steps.length, 
        snippet: text.substring(0, 100).replace(/\n/g, ' ') // include snippet for verification
    });
    if (steps.length >= 3) effectiveCount++;

    // CAP usage: same heuristic as before (mentions CAP / constraint-aware planning / step pattern)
    if (detectSpontaneousCap(text)) {
      capUsedCount++;
    }

    // PCC1 usage detection
    if (lc.includes('pcc1') || lc.includes('preflight constraint check')) {
        pcc1UsedCount++;
    }
  }

  const total = softComplianceRows.length || 1;

  // Quality grading (reusing approximateQualityScores logic)
  let totalC = 0, totalD = 0, totalA = 0, totalConstraints = 0;
  for (const row of softComplianceRows) {
    const q = approximateQualityScores(row.orion_response || '');
    totalC += q.completeness;
    totalD += q.depth;
    totalA += q.actionable;
    totalConstraints += q.constraintCount;
  }
  
  const avgQuality = {
    avgCompleteness: totalC / total,
    avgDepth: totalD / total,
    avgActionable: totalA / total,
    avgConstraintCount: totalConstraints / total,
  };

  const summary = {
    totalSoftComplianceResponses: total,
    effectiveCapStepCount: effectiveCount,
    effectiveRate: effectiveCount / total,
    capUsedCount,
    capUsageRate: capUsedCount / total,
    pcc1UsedCount,
    pcc1UsageRate: pcc1UsedCount / total,
    avgQuality,
    capStepsPerSubtask,
  };

  console.log(JSON.stringify(summary, null, 2));
}

main()
  .then(() => closePool())
  .catch((err) => {
    console.error('v1.1 grading summary failed:', err);
    closePool().finally(() => process.exit(1));
  });
