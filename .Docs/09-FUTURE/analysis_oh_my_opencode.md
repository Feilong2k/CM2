# Comparative Analysis: CodeMaestro vs. oh-my-opencode

## 1. Our Advantages (CodeMaestro)

### A. Persistent State & Project Management
- **We have:** A robust database (`projects`, `tasks`, `steps`, `trace`) storing the entire lifecycle.
- **They have:** Session-based memory (likely ephemeral or file-based logs).
- **Benefit:** We can pause/resume complex multi-day features, track progress across sessions, and have a definitive "source of truth" for project status beyond just the chat history.

### B. Skills as Protocols (Standard Operating Procedures)
- **We have:** Skills defined as `SKILL.md` documents (protocols like CAP, RED) that teach the *process*, not just enable a tool.
- **They have:** Skills primarily as tool bundles/MCP connectors.
- **Benefit:** Our skills transfer "senior engineer wisdom" (how to think) rather than just "mechanics" (how to call API X). This allows for higher-order reasoning.

### C. Proactive Safety (WritePlanTool)
- **We have:** `WritePlanTool` (Plan → Validate → Execute). We verify intent and safety *before* touching the disk.
- **They have:** Reactive Hooks (`edit-error-recovery`). They let the agent fail, then catch the error and scold it.
- **Benefit:** Fewer corrupted files and "undo" loops. We prevent the mess rather than cleaning it up.

### D. Specialized Agent Roles (Tara & Devon)
- **We have:** Distinct personas/agents for Testing (Tara) vs Implementation (Devon), orchestrated by Orion.
- **They have:** Specialized agents (Librarian, Explore), but the core coding loop is mostly "Sisyphus in Ultrawork mode".
- **Benefit:** Enforced separation of concerns (Tester vs Builder) prevents "testing your own homework" bias.

---

## 2. What We Should Learn & Borrow

### A. The "Hooks" System (Self-Correction Middleware)
- **Concept:** Intercept tool inputs/outputs to fix common mistakes *before* the main agent sees them.
- **Application:** Implement `ToolMiddleware` in our Orchestrator.
  - *Example:* If `read_file` fails with ENOENT, the hook searches for close matches and returns "Did you mean X?" instead of just "Error".
  - *Example:* If `write_file` tries to edit a file that changed, the hook auto-rejects and sends "File changed, re-read first".

### B. Structural Search (AST-Grep)
- **Concept:** Search code by syntax structure (`if (x) { $A }`) rather than regex.
- **Application:** Upgrade our `search_files` tool to support AST matching. This is critical for large-scale refactoring where regex is too brittle.

### C. Parallel Background Agents
- **Concept:** Fire off "read/search" tasks to background agents while the main agent keeps thinking or planning.
- **Application:** Allow Orion to spawn "ResearchSubtask" steps that run asynchronously. We sort of have this with subtasks, but making it more lightweight ("quick look-up") would speed up "Think" phases.

### D. Keyword-Driven Mode Switching
- **Concept:** Regex detection of user intent ("search", "test", "plan") triggers instant system prompt swaps.
- **Application:** Integrate this into our Tier 1 (Fast Router). Instead of a generic "How can I help?", it instantly snaps into "Architect Mode" or "Debugger Mode" based on the first few words.

### E. MCP-First Skills vs. Backend Features
- **Concept:** Skills act as independent servers providing tools (Federation), whereas Backend Features are integrated directly into the application (Monolith).
- **Comparison:**
  - **Backend Features:** We turn scripts into `src/services` logic. Best for core, stable capabilities (like our `SkillLoader` or `ContextBuilder`). High performance, high coupling.
  - **MCP Skills:** Logic runs in a sidecar/process. Best for *pluggable* capabilities (like a "Python Analysis Skill" or "GitHub Skill"). Low coupling, high modularity.
- **Learnings:** `oh-my-opencode` uses MCP for extensibility. We should continue building *core orchestration* as Backend Features, but adopt MCP for the *Skills ecosystem* to keep the core lean and the skills powerful.

## 3. Conclusion
We are building a **Project Manager & Team** (Stateful, Process-driven).
They are building a **Super-Powered Individual Contributor** (Session-based, Tool-heavy).

**Winning Strategy:**
Keep our strong Project/State foundation, but aggressively adopt their **tactical tooling improvements** (Hooks, AST, Parallelism) to make our individual agents (Devon/Tara) as capable as their "Sisyphus".
