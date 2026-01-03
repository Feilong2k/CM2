// Simple grading/summary script for three-phase CAP probe results.
// This does not write per-response grades to the DB; it computes
// aggregate metrics directly from skill_test_responses for a quick view.

const { query, closePool } = require('../../../src/db/connection');

async function fetchLatestPerPhaseAndSubtask() {
  const res = await query(
    `SELECT id, test_phase, subtask_id, user_prompt, orion_response, response_metadata, created_at
     FROM skill_test_responses
     ORDER BY test_phase, subtask_id, created_at`
  );

  const latest = new Map(); // key: phase|subtask_id -> row

  for (const row of res.rows) {
    const key = `${row.test_phase}|${row.subtask_id}`;
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
  const latest = await fetchLatestPerPhaseAndSubtask();

  const phases = {
    baseline: [],
    discovery: [],
    compliance: [],
  };

  for (const row of latest) {
    if (phases[row.test_phase]) {
      phases[row.test_phase].push(row);
    }
  }

  // Basic counts
  const phaseCounts = Object.fromEntries(
    Object.entries(phases).map(([phase, rows]) => [phase, rows.length])
  );

  // Clarification counts per phase
  const clarCounts = {};
  for (const [phase, rows] of Object.entries(phases)) {
    let withClar = 0;
    for (const row of rows) {
      const meta = row.response_metadata || {};
      if (meta.has_clarification === true) withClar++;
    }
    clarCounts[phase] = withClar;
  }

  // Discovery: spontaneous CAP usage
  let discoveryCapUsed = 0;
  for (const row of phases.discovery) {
    if (detectSpontaneousCap(row.orion_response)) discoveryCapUsed++;
  }

  // Compliance: effective CAP (>=3 numbered steps)
  let complianceEffective = 0;
  const complianceCapSteps = [];
  for (const row of phases.compliance) {
    const steps = detectCapSteps(row.orion_response);
    complianceCapSteps.push(steps.length);
    if (steps.length >= 3) complianceEffective++;
  }

  // Quality scores per phase
  const qualityByPhase = {};
  for (const [phase, rows] of Object.entries(phases)) {
    let totalC = 0, totalD = 0, totalA = 0, totalConstraints = 0;
    for (const row of rows) {
      const q = approximateQualityScores(row.orion_response || '');
      totalC += q.completeness;
      totalD += q.depth;
      totalA += q.actionable;
      totalConstraints += q.constraintCount;
    }
    const n = rows.length || 1;
    qualityByPhase[phase] = {
      avgCompleteness: totalC / n,
      avgDepth: totalD / n,
      avgActionable: totalA / n,
      avgConstraintCount: totalConstraints / n,
    };
  }

  const summary = {
    phaseCounts,
    clarificationCounts: clarCounts,
    discovery: {
      total: phases.discovery.length,
      spontaneousCapUsed: discoveryCapUsed,
      spontaneousRate: phases.discovery.length
        ? discoveryCapUsed / phases.discovery.length
        : 0,
    },
    compliance: {
      total: phases.compliance.length,
      effectiveCapStepCount: complianceEffective,
      effectiveRate: phases.compliance.length
        ? complianceEffective / phases.compliance.length
        : 0,
      capStepsApplied: complianceCapSteps,
    },
    qualityByPhase,
  };

  console.log(JSON.stringify(summary, null, 2));
}

main()
  .then(() => closePool())
  .catch((err) => {
    console.error('grading summary failed:', err);
    closePool().finally(() => process.exit(1));
  });

