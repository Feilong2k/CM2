#!/usr/bin/env node

// Probe: SkillLoader metadata dump
//
// This script loads the SkillLoader and prints out the metadata it discovers
// from SKILL.md files under the skills root. Use it to visually inspect what
// the SkillLoader is returning.

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const path = require('path');

// SkillLoader should live at backend/src/skills/SkillLoader.js
const SkillLoader = require('../../src/skills/SkillLoader');

async function main() {
  // CLI usage:
  //   node probe_skill_loader.js            -> full metadata from backend/Skills
  //   node probe_skill_loader.js --visible  -> visible skills only (getVisibleSkills) from backend/Skills
  //   node probe_skill_loader.js <root>     -> full metadata from custom root
  //   node probe_skill_loader.js --visible <root> -> visible skills from custom root

  const args = process.argv.slice(2);

  const visibleFlagIndex = args.indexOf('--visible');
  const visibleOnly = visibleFlagIndex !== -1;

  // Remove flags from args, remaining first arg (if any) is treated as root override
  const positionalArgs = args.filter(arg => arg !== '--visible');
  const rootArg = positionalArgs[0];

  // Default to backend/Skills (canonical skills root)
  const defaultRoot = path.join(__dirname, '../../Skills');
  const rootDir = rootArg ? path.resolve(rootArg) : defaultRoot;

  console.log(`[SkillLoader Probe] Using skills root: ${rootDir}`);
  console.log(`[SkillLoader Probe] Mode: ${visibleOnly ? 'visible skills (getVisibleSkills)' : 'full metadata (loadSkillMetadata)'}`);

  const loader = new SkillLoader(rootDir);

  try {
    const data = visibleOnly
      ? await loader.getVisibleSkills()
      : await loader.loadSkillMetadata();

    console.log('\n[SkillLoader Probe] Output:');
    console.log(JSON.stringify(data, null, 2));

    console.log(`\n[SkillLoader Probe] Loaded ${data.length} skill(s).`);
  } catch (err) {
    console.error('[SkillLoader Probe] Error while loading skills:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };
