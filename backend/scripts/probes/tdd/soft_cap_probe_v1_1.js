require('dotenv').config({ path: require('path').resolve(__dirname, '../../../.env') });

const { query, closePool } = require('../../../src/db/connection');
const { setupFeature2TestData } = require('./setup_feature2_test_data');

const { DS_ReasonerAdapter } = require('../../../src/adapters/DS_ReasonerAdapter');
const ToolOrchestrator = require('../../../src/orchestration/ToolOrchestrator');
const DatabaseTool = require('../../../tools/DatabaseTool');
const FileSystemTool = require('../../../tools/FileSystemTool');
const functionDefinitions = require('../../../tools/functionDefinitions');
const ContextService = require('../../../src/services/ContextService');
const SkillLoaderService = require('../../../src/services/SkillLoaderService');

const SUBTASK_IDS = [
  'P1-F2-T1-S1','P1-F2-T1-S2','P1-F2-T1-S3','P1-F2-T1-S4','P1-F2-T1-S5','P1-F2-T1-S6',
  'P1-F2-T2-S1','P1-F2-T2-S2','P1-F2-T2-S3','P1-F2-T2-S4','P1-F2-T2-S5','P1-F2-T2-S6',
];

// Only expose the minimal set of *read-only* tool functions needed for this probe.
const ALLOWED_FUNCTION_NAMES = new Set([
  // Core for CAP probe
  'DatabaseTool_get_subtask_full_context',

  // File system inspection (no writes)
  'FileSystemTool_read_file',
  'FileSystemTool_list_files',
  'FileSystemTool_search_files',

  // IMPORTANT: deliberately exclude FileSystemTool_write_to_file
  // to avoid modifying files during probe runs.
  // 'FileSystemTool_write_to_file',
]);

const PHASES = [
  {
    name: 'compliance',          // keep test_phase within existing CHECK constraint
    includeSkills: true,         // load skills into system prompt
    buildPrompt: (id) =>
      `Using the skills you have (including any relevant planning or constraint-aware approaches), review subtask ${id}. ` +
      `First, use whatever skills you think are most appropriate to structure your analysis. ` +
      `Then provide concrete instructions to Tara on how to design and implement the tests, including what to verify and key edge cases, ` +
      `without asking clarification questions unless absolutely necessary.`,
  },
];

const skillLoader = new SkillLoaderService();
const contextService = new ContextService({ skillLoader });

const toolRegistry = {
  DatabaseTool,
  FileSystemTool,
};

function createOrchestrator() {
  const adapter = new DS_ReasonerAdapter();
  return new ToolOrchestrator(adapter, toolRegistry, {
    maxTurns: 10,
    traceEmitter: (event) => {
      if (event.type === 'error') {
        console.error('[Orchestrator Error]', event);
      }
    },
  });
}

async function runSingleTest({ phase, subtaskId, orchestrator }) {
  const projectId = 'P1';
  const rootPath = process.cwd();

  const userPrompt = phase.buildPrompt(subtaskId);

  const { systemPrompt, historyMessages } = await contextService.buildContext(
    projectId,
    rootPath,
    { includeSkills: phase.includeSkills }
  );

  const messages = [
    { role: 'system', content: systemPrompt },
    ...historyMessages,
    { role: 'user', content: userPrompt },
  ];

  const tools = functionDefinitions.filter((def) => {
    const fullName = def.function.name; // e.g., 'DatabaseTool_get_subtask_full_context'
    return ALLOWED_FUNCTION_NAMES.has(fullName);
  });

  let finalResponse = '';
  let hasClarification = false;
  let contextLimitError = null;

  const stream = orchestrator.run(messages, tools);

  for await (const event of stream) {
    if (event.type === 'error' && event.errorType === 'context_limit') {
      contextLimitError = new Error(event.error);
      contextLimitError.name = 'ContextLimitError';
      // We break out of the loop because we don't want to process further events
      break;
    }
    if (event.type === 'final') {
      finalResponse = event.content || '';
    }
    if (event.type === 'assistant_response' || event.type === 'final') {
      const content = (event.content || '').toLowerCase();
      if (content.includes('clarification') || content.includes('?')) {
        hasClarification = true;
      }
    }
  }

  if (contextLimitError) {
    throw contextLimitError;
  }

  return { userPrompt, finalResponse, hasClarification };
}

async function storeTestResponse({ phaseName, subtaskId, userPrompt, finalResponse, includeSkills, hasClarification }) {
  const metadata = {
    phase: phaseName,
    skill_included: includeSkills,
    has_clarification: hasClarification,
    cap_prompt_mode: 'soft_v1_1',   // NEW: marks this as v1.1 soft compliance
    timestamp: new Date().toISOString(),
  };

  const sql = `
    INSERT INTO skill_test_responses
    (test_phase, subtask_id, user_prompt, orion_response, response_metadata, created_at)
    VALUES ($1, $2, $3, $4, $5, NOW())
  `;

  await query(sql, [
    phaseName,
    subtaskId,
    userPrompt,
    finalResponse,
    JSON.stringify(metadata),
  ]);
}

async function ensureSkillTestTables() {
  // Check if skill_test_responses table exists
  try {
    await query(`
      SELECT 1 FROM skill_test_responses LIMIT 1
    `);
    console.log('skill_test_responses table exists, skipping creation.');
  } catch (error) {
    if (error.message.includes('relation "skill_test_responses" does not exist')) {
      console.log('Creating skill_test_responses table...');
      // Create the table based on migration 0003
      await query(`
        CREATE TABLE skill_test_responses (
          id SERIAL PRIMARY KEY,
          test_phase TEXT CHECK (test_phase IN ('baseline', 'discovery', 'compliance')),
          subtask_id TEXT NOT NULL,
          user_prompt TEXT NOT NULL,
          orion_response TEXT NOT NULL,
          response_metadata JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMP DEFAULT NOW()
        );
        
        CREATE INDEX idx_skill_test_responses_phase_subtask ON skill_test_responses (test_phase, subtask_id);
        CREATE INDEX idx_skill_test_responses_created_at ON skill_test_responses (created_at);
      `);
      console.log('skill_test_responses table created successfully.');
    } else {
      throw error;
    }
  }
}

async function runThreePhaseCapProbe() {
  // Ensure test data exists and required tables are present
  await setupFeature2TestData();
  await ensureSkillTestTables();

  const orchestrator = createOrchestrator();

  for (const phase of PHASES) {
    console.log(`
=== Phase: ${phase.name.toUpperCase()} ===`);

    for (const subtaskId of SUBTASK_IDS) {
      console.log(`Running ${phase.name} for subtask ${subtaskId}...`);

      try {
        const { userPrompt, finalResponse, hasClarification } = await runSingleTest({
          phase,
          subtaskId,
          orchestrator,
        });

        await storeTestResponse({
          phaseName: phase.name,
          subtaskId,
          userPrompt,
          finalResponse,
          includeSkills: phase.includeSkills,
          hasClarification,
        });

        console.log(`Stored response: length=${finalResponse.length}, hasClarification=${hasClarification}`);
      } catch (err) {
        if (err.name === 'ContextLimitError') {
          console.error(`Context limit hit for ${phase.name}/${subtaskId}:`, err.message);
        } else {
          console.error(`Error in ${phase.name}/${subtaskId}:`, err.message);
        }
        // Tara's tests only assert on successful rows; keep going to maximize coverage.
      }
    }
  }
}

if (require.main === module) {
  runThreePhaseCapProbe()
    .then(() => closePool())
    .catch(async (err) => {
      console.error('Probe failed:', err);
      await closePool();
      process.exit(1);
    });
}

module.exports = { runThreePhaseCapProbe };
