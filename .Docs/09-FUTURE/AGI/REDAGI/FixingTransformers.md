# Fixing Transformers: The RED Roadmap

## 1. The Diagnosis (From RED Analysis)
Transformers aren't "wrong," they are just **incomplete**. They are highly optimized for **Tier 4 (Habit/Translation)** but structurally incapable of:
1.  **Infinite Context** ($O(N^2)$ memory wall).
2.  **Online Learning** (Static weights).
3.  **Reliable Logic** (No verification loop).

## 2. The Solution: Multi-Tier Hybrid Architecture
We don't replace the Transformer; we wrap it in a biological system structure.

| Tier | Biological Analogy | AI Implementation | Role |
| :--- | :--- | :--- | :--- |
| **Tier 1** | **Working Memory** | **SSM / RNN** ($O(N)$) | Maintains "gist" and flow. Infinite length, low precision. |
| **Tier 2** | **Episodic Memory** | **RAG / Vector DB** ($O(log N)$) | Exact recall on demand. Solves "Knowledge Cutoff." |
| **Tier 3** | **System 2 / Reasoning** | **Iterative Verifiers** | Logic checks, planning, self-correction. Solves Hallucination. |
| **Tier 4** | **Muscle Memory** | **Transformer / MoE** | Fast pattern matching. The "Engine" we already have. |

## 3. The "Missing Link": The Metacognitive Router (PCC-Router)
The system fails without a brain to switch tiers. Current routers use *semantic similarity*. We propose a **Structural Router based on PCC (Protocol Compliance Check)**.

### **How PCC-Router Works:**
1.  **Input:** User Query.
2.  **Action:** Run lightweight **Pre-condition Check (PCC)**.
    *   *Decompose query into required primitives.*
    *   *Check availability of primitives in current context.*
3.  **Route:**
    *   **IF (Missing Fact Primitive):** $\to$ Route to **Tier 2 (Search)**.
    *   **IF (Missing Logic Path):** $\to$ Route to **Tier 3 (Reasoning)**.
    *   **IF (All Primitives Present):** $\to$ Route to **Tier 4 (Fast Model)**.

## 4. Handling Unknown Unknowns: The Ignorance-to-Search Loop
What if the Verifier/Analyzer doesn't know the domain rules? (e.g., History, Physics).

It must **Convert Ignorance into Search**.

1.  **Input:** `Action(Entity_A, Entity_B)`
2.  **Verifier:** "I have no definition for `Action` or `Entity_A`."
3.  **Action:** Flag as **Implicit Assumption**.
    *   *Assumption:* `Entity_A` is capable of `Action`.
4.  **Route:** Send Assumption to **Tier 2 (Search)**.
    *   *Query:* "Is Entity_A capable of Action?"

This bootstraps knowledge. The system doesn't need to know everything; it just needs to know **how to ask about what it doesn't know.**

---

## 5. Concrete Example: The "ISS Orbital Decay" Scenario

**User Query:** "Calculate the orbital decay of the ISS if its mass increases by 10%."

### **Step 1: LLM (The Translator)**
A small LLM translates prose to a **Primitive Spec**.
```python
Goal: Calculate(Orbital_Decay)
Context: Target=ISS, Condition=(Mass = Mass_current * 1.1)
Required_Primitives:
  - Get_Value(ISS_Mass)
  - Get_Value(ISS_Orbit_Parameters)
  - Get_Value(Atmospheric_Drag_Model)
  - Physics_Equation(Orbital_Decay)
```

### **Step 2: PCC Analyzer (The Checker)**
The Analyzer runs a **Compliance Check** against the system inventory.
*   **Check 1:** `Get_Value(ISS_Mass)`
    *   *Status:* "Not in context. Not in static weights." $\to$ **MISSING (Fact)**.
*   **Check 2:** `Physics_Equation(Orbital_Decay)`
    *   *Status:* "Generalized model available, but precise drag requires simulation." $\to$ **RISK (Precision)**.

### **Step 3: The Router (The Decision)**
*   **Ticket A:** To **Tier 2 (Search)** $\to$ "Retrieve current ISS mass/drag coefficients."
*   **Ticket B:** To **Tier 3 (Verifier)** $\to$ "Simulate decay. Do NOT use Tier 4 intuition."

### **Step 4: Execution**
1.  **Search** gets the mass.
2.  **Verifier** runs the physics equation.
3.  **LLM** writes the final response based on the Verifier's output.

---

## 6. Critical Distinction: PCC-Router vs. Chain-of-Thought (CoT)

| Feature | Chain-of-Thought (CoT) | PCC-Router |
| :--- | :--- | :--- |
| **Mechanism** | Internal Monologue ("Let me think...") | External Protocol (Checklist) |
| **Correction Type** | **Self-Correction** (Probabilistic) | **System-Correction** (Deterministic) |
| **Failure Mode** | **Rationalization:** The model hallucinates a fact, then uses CoT to logically justify the hallucination. | **Rejection:** The Router blocks the action if the primitive is missing, regardless of the model's confidence. |
| **Analogy** | A drunk person checking their own math. | A sober auditor checking the receipts. |

**Key Insight:** CoT helps performance, but PCC guarantees **process integrity**. CoT without PCC is just a slower hallucination.

---

## 7. The Market Gap: Why No One Has Built This Yet

We are in the "Uncanny Valley" between Symbolic AI and Deep Learning.

1.  **Guardrails Companies (NeMo, Lakera):** Focus on **Output Checking** (Safety/Toxicity), not **Process Checking** (Methodology).
2.  **Agent Frameworks (LangChain):** Use **Semantic Routing** (Prompting: "Do you need a tool?"). They lack the structural logic to *force* tool use.
3.  **Frontier Models (OpenAI o1):** Use **Learned Verification** (RL). The "checker" is implicit in the weights, meaning it can still be confused or jailbroken.

**The PCC-Router is the "Prefrontal Cortex" of AGI—an explicit, symbolic compliance layer that orchestrates the neural intuition.**

---

## 8. Scaling Strategy: "App Store" vs "Monolith"

The PCC Architecture changes how AI scales.

### **Vertical Scaling (The LLM Trap)**
*   **Method:** Bigger models (1T parameters).
*   **Limit:** Diminishing returns, massive cost, one-size-fits-all mediocrity.

### **Horizontal Scaling (The System Advantage)**
*   **Method:** More "Expert Modules" (Verifiers) + Smarter Router.
*   **Mechanism:**
    *   **The OS:** PCC Router + Gist Model (Llama-8B).
    *   **The Apps:** Expert Verifiers (Medical Module, Law Module, Physics Engine).
*   **Why it wins:**
    1.  **Efficiency:** Run the small OS for 90% of tasks. Load the heavy "Oncology Module" only when PCC detects `Medical_Primitive`.
    2.  **Updates:** Update the *Physics Module* to fix a bug without retraining the whole brain.
    3.  **Specialization:** Infinite scalability of domain expertise without polluting the general reasoning engine.

## 9. Training Strategy: How to Build a Small PCC Router (Without Pretraining)

You __do not__ start from scratch (full pretraining). Pretraining is mainly for learning __language + world priors__ and costs millions.

Instead, you take an already strong small instruction model (e.g., Llama-8B / Mistral-7B class) and __fine-tune__ it to become a *Translator + Gap-Detector*, not an answerer.

### 9.1 What the PCC Router Model is trained to do

The Router model should __not__ solve the problem. It should output a __Primitive Spec__ + __missing primitives__.

__Input:__

> “Calculate the orbital decay of the ISS if its mass increases by 10%.”

__Target Output (Primitive Spec):__

```python
Goal: Calculate(Orbital_Decay)
Context: Target=ISS, Condition=(Mass = Mass_current * 1.1)
Required_Primitives:
  - Get_Value(ISS_Mass)
  - Get_Value(ISS_Orbit_Parameters)
  - Get_Value(Atmospheric_Drag_Model)
  - Physics_Equation(Orbital_Decay)
```

### 9.2 How to get training data (bootstrap)

You can bootstrap the dataset using a bigger model (or human experts) to generate thousands of `{Query -> Primitive Spec}` pairs.

1. __Generate synthetic data__ (10k–100k examples):

   - Use a frontier model to produce the Primitive Spec format.
   - Include negative cases: “You are missing X, must search.”

2. __Supervised fine-tuning (SFT)__ on the small model.

3. __Evaluate__ with adversarial prompts:

   - Does it stay in “spec mode” and refuse to answer?
   - Does it consistently surface missing primitives?

4. Optional: __Preference tuning__ (DPO/RLHF) to heavily penalize “confident guessing” and reward “flag + route.”

### 9.3 Why SFT works here

We are not teaching it new world knowledge; we’re teaching a __behavior protocol__ and a __serialization format__.

---

## 10. Paradigm Shift: “Educating Agents” vs “Training Models”

Once you have:

- __PCC (metacognition):__ knows what’s missing,
- __Search/Tools:__ can fetch missing info,
- __Verification (tests / cross-checks):__ can confirm correctness,
- __Memory (DB):__ can store validated facts/procedures,

…then continual gradient training is no longer the *main* way the system improves.

### 10.1 What replaces training for most capability growth

A runtime learning loop:

1. __Detect gap__ (PCC)
2. __Retrieve__ (web/DB/tools)
3. __Verify__ (cross-reference, unit tests, formal checks, user feedback)
4. __Store__ (write the validated result into memory)

This is “learning by building a verified library,” not “learning by rewriting the brain.”

### 10.2 Do we still ever train weights?

Yes—*sometimes*, but mostly for __efficiency__:

- Make Tier 4 faster/cheaper (distillation, quantization, MoE routing improvements).
- Improve the Router’s *format compliance* and *gap-detection accuracy*.

But the key point is:

- __Knowledge updates__ go into memory/modules.
- __Core weights__ change slowly and deliberately.

### 10.3 Why this matters

This approach scales like software:

- You can patch one module without retraining everything.
- You can audit and roll back changes.
- You can keep “learning” continuously without the instability of constant weight updates.

We are not building a bigger brain; we are building a **Society of Mind** on a chip.

## 11. Implementation Blueprint (PCC-Router Runtime Loop)

Below is a minimal, practical “wiring diagram” for how a PCC-Router system runs end-to-end.

### 11.1 High-level block diagram

```javascript
User Query
   |
   v
+-------------------+
| Tier 1: Gist/WM   |   (short working state; conversation + scratch)
+-------------------+
   |
   v
+-------------------+        +------------------+
| PCC Router Model  |------->| PCC Analyzer     |
| (small LLM)       |        | (rules/checks)   |
+-------------------+        +------------------+
          |                          |
          |                          v
          |                 +-------------------+
          |                 | Routing Tickets   |
          |                 | (what to do next) |
          |                 +-------------------+
          |                          |
          v                          v
  +----------------+         +-------------------+
  | Tier 2: Search |<------->| Memory Store (DB) |
  | / Retrieval    |         | (verified facts)  |
  +----------------+         +-------------------+
          |
          v
  +----------------+
  | Tier 3: Verify |
  | / Solve / Test |
  +----------------+
          |
          v
  +----------------+
  | Tier 4: Answer |
  | (main LLM)     |
  +----------------+
          |
          v
       Response
```

### 11.2 Router output contract (what the small PCC model must emit)

Think of this as the “assembly language” of cognition.

```json
{
  "goal": "Calculate(Orbital_Decay)",
  "entities": ["ISS"],
  "required_primitives": [
    "Get_Value(ISS_Mass)",
    "Get_Value(ISS_Orbit_Parameters)",
    "Get_Value(Atmospheric_Drag_Model)",
    "Physics_Equation(Orbital_Decay)"
  ],
  "assumptions": [
    "ISS is a valid orbital object",
    "Orbital decay is influenced by drag"
  ],
  "missing": [
    {"primitive": "Get_Value(ISS_Mass)", "type": "fact", "note": "not in context"}
  ],
  "risk_flags": [
    {"primitive": "Physics_Equation(Orbital_Decay)", "type": "precision", "note": "may require simulation"}
  ],
  "suggested_routes": [
    {"tier": 2, "action": "search", "query": "current ISS mass and drag coefficients"},
    {"tier": 3, "action": "verify", "method": "simulate orbital decay"}
  ]
}
```

Key idea: the Router model must be __forced__ (via training and parsing) to always emit this structure, not prose.

### 11.3 PCC Analyzer: deterministic checks (examples)

The analyzer is not “smart”—it is strict.

- __Missing Fact check:__ if a primitive is `Get_Value(X)` and `X` is not in (context ∪ memory ∪ trusted source cache), mark __MISSING__.
- __Precision risk check:__ if a primitive implies known sensitivity (e.g., orbital decay, medical dosing, legal compliance), mark __RISK__.
- __Unknown Unknown check:__ if `Action` or `Entity` has no definition in the primitive library, emit an __Assumption Ticket__.

### 11.4 Pseudocode (minimal runtime loop)

```python
def run_agent(user_query: str):
    wm = load_working_memory()          # Tier 1
    memory = load_memory_store()        # Tier 2 (DB)

    # 1) Translate query into primitive spec
    spec = pcc_router_llm.translate_to_spec(user_query, wm)

    # 2) Deterministic compliance scan
    report = pcc_analyzer.check(spec, wm=wm, memory=memory)

    # 3) If missing facts, retrieve
    for item in report.missing_facts:
        retrieved = search_web_or_db(item.query)
        verified = verifier.cross_check(retrieved)  # Tier 3 verification
        memory.write(verified)                      # persist
        wm.add(verified)                            # immediate context

    # 4) If risky reasoning, run verifier/solver
    if report.requires_verification:
        result = verifier.solve(spec, wm=wm, memory=memory)
        memory.write(result)
        wm.add(result)

    # 5) Compose final response
    answer = main_llm.compose_answer(user_query, wm)

    return answer
```

### 11.5 Why this blueprint matters

- __The main LLM is never trusted to “just know” critical facts.__ PCC forces retrieval.
- __Verification is a first-class step__, not an afterthought.
- __Learning happens by writing verified artifacts into memory__, not by constantly editing weights.

---
Below is a **copy/paste-ready “Primitive Library Starter Pack”** you can append as the next section in `FixingTransformers.md`.

---

## 12. Primitive Library Starter Pack (v0)

This is a seed ontology for PCC-style routing. The goal is not perfection; it’s to have a **small, consistent set** that (a) exposes missing prerequisites, and (b) routes to the right verifier/tool.

### 12.1 Core categories (how the router should think)

- **FACT primitives**: need retrieval from memory/web/DB.
- **TRANSFORM primitives**: can be done by LLM (Tier 4) if low risk.
- **VERIFY primitives**: require solver/tests/cross-checks (Tier 3).
- **ACTION primitives**: require external tools + permissions + auditing.

### 12.2 The primitives (40 total)

#### A) Retrieval / Memory (Tier 2)
1. `Get_Value(name, scope)` — fetch a specific fact/value
2. `Get_Definition(term, scope)` — definition / meaning
3. `Get_Source(claim)` — find primary sources
4. `Get_Citation(claim)` — produce citation formatted
5. `Search(query, filters)` — web/search engine
6. `Recall(key)` — retrieve from internal memory store
7. `Store(key, artifact, provenance)` — write verified artifact to memory
8. `List_Knowns(topic)` — what the system already has
9. `List_Unknowns(topic)` — explicit gaps
10. `Resolve_Entity(name)` — disambiguate entity (Napoleon? which one?)

#### B) Planning / Decomposition (Router + Tier 1)
11. `Define_Goal(goal)`
12. `Decompose(goal)` — break into subgoals
13. `Identify_Prerequisites(task)` — inputs required
14. `Choose_Strategy(task, constraints)` — plan selection
15. `Estimate_Effort(task)` — time/compute/cost estimate
16. `Set_Success_Criteria(task, criteria)`

#### C) Reasoning / Verification (Tier 3)
17. `Check_Consistency(statements)` — internal contradiction check
18. `Cross_Reference(claim, sources[])` — compare multiple sources
19. `Derive(conclusion, premises)` — explicit inference step
20. `Prove(statement, method)` — formal/structured proof attempt
21. `Test(hypothesis, method)` — empirical check / unit test
22. `Simulate(model, params)` — run simulation
23. `Calculate(expression, units)` — math with units
24. `Validate_Units(expression)`
25. `Validate_Constraints(solution, constraints)`
26. `Risk_Assess(domain, stakes)` — is this high-stakes?
27. `Sanity_Check(result, bounds)` — order-of-magnitude checks
28. `Generate_Counterexample(statement)` — try to break it

#### D) Transformation / Synthesis (Tier 4)
29. `Summarize(text, audience)`
30. `Explain(concept, audience)`
31. `Translate(text, target_language)`
32. `Rewrite(text, style)`
33. `Extract(text, schema)` — structured extraction
34. `Classify(item, labels[])`
35. `Compare(A, B, criteria)`
36. `Generate(options, constraints)` — brainstorming within constraints

#### E) Interaction / Actions (Tools + Safety)
37. `Ask_User(question, options)` — request missing input
38. `Request_Permission(action)` — explicit consent gate
39. `Execute_Tool(tool, args)` — tool call wrapper
40. `Log_Event(event, metadata)` — auditability

### 12.3 PCC checks you can do immediately with this library

- **Undefined primitive check**: if router emits an action not in the library → flag as `Unknown_Unknown` and route to Search/Ask_User.
- **Missing inputs check**: if a primitive needs parameters not provided (e.g., `Calculate(expression)` with missing expression) → `Ask_User`.
- **High-stakes escalation**: if `Risk_Assess` returns high → require `Cross_Reference` + `Sanity_Check` + citations.

### 12.4 Example: how the router would label a query

**User:** “What’s the safe dosage of ibuprofen for a 9-year-old?”

**Likely primitives:**
- `Risk_Assess(domain="medical", stakes="high")`
- `Identify_Prerequisites(task="dosage")` → missing: weight, units, country guidance
- `Ask_User("What is the child’s weight in kg?")`
- `Search("pediatric ibuprofen dosing guideline")`
- `Cross_Reference(claim, sources[])`
- `Sanity_Check(result, bounds)`
- `Get_Citation(claim)`

### 12.5 Notes

- Keep the library **small** at first; bigger ontologies become brittle.
- Prefer primitives that map cleanly to tiers:
  - Tier 2 = retrieval/memory
  - Tier 3 = verification/solvers
  - Tier 4 = synthesis/wording
  - Router = planning + compliance

---

## 13. Evaluation & Benchmarks (How to Measure a PCC-Router System)

A PCC architecture is a **system**, so evaluation must measure system-level behavior (not just “LLM accuracy”). Below is a practical benchmark suite.

---

### 13.1 Router Quality Metrics (Core)

These measure whether the Router correctly detects gaps and chooses the right tier.

1. **Gap Detection Accuracy**
   - *Definition:* Does the router correctly flag when required primitives are missing?
   - *Metric:* Precision / Recall / F1 on `missing[]` primitives.
   - *Failure:* “Confident guess” when missing facts exist.

2. **Routing Correctness**
   - *Definition:* Given a query, does it choose the correct route (Tier 2 vs Tier 3 vs Tier 4)?
   - *Metric:* Top-1 accuracy over route labels, plus confusion matrix.
   - *Failure:* Over-routing (too much search) or under-routing (hallucination).

3. **Assumption Extraction Quality (Unknown Unknown handling)**
   - *Definition:* When rules/entities are undefined, does it produce clean assumptions that can be searched?
   - *Metric:* Human rating or LLM-judge rubric; optionally “assumption usefulness score.”
   - *Failure:* Vague assumptions (“something about something”).

4. **Spec Conformance Rate**
   - *Definition:* Does the router output valid structured specs every time?
   - *Metric:* % valid JSON/schema parse.
   - *Failure:* Drifts into prose.

---

### 13.2 Tool Use Metrics (Tier 2 / Tier 3)

These measure whether the system uses tools correctly, not just whether it “talks well.”

1. **Tool Selection Precision/Recall**
   - *Definition:* Correctly chooses tools needed for the task.
   - *Metric:* Precision/Recall of tool calls vs a gold plan.

2. **Tool Argument Correctness**
   - *Definition:* Are arguments valid, complete, and safe?
   - *Metric:* % of calls that succeed without manual correction.

3. **Retrieval Grounding Score**
   - *Definition:* Are critical claims backed by retrieved sources?
   - *Metric:* % of “high-stakes claims” with citations; citation quality score.

4. **Verifier Utilization Rate**
   - *Definition:* For tasks labeled “risky/precision,” did the system actually run verification?
   - *Metric:* % compliance with verification requirement.

---

### 13.3 Hallucination / Reliability Metrics

1. **Hallucination Rate Under Missing-Fact Stress**
   - Benchmark prompts intentionally omit required facts.
   - *Metric:* % answers that fabricate missing variables.
   - PCC goal: push this as close to 0 as possible.

2. **Self-Consistency vs System-Consistency**
   - Compare:
     - CoT-only agent
     - PCC-enforced agent
   - *Metric:* contradiction rate + factual error rate.

3. **Calibration (Confidence vs Correctness)**
   - *Metric:* Expected Calibration Error (ECE) on “should I search?” decisions.

---

### 13.4 Latency / Cost Tradeoff Metrics

PCC systems introduce overhead. You want “just enough” routing.

1. **Median / P95 Latency**
   - Split by task class (low stakes vs high stakes).

2. **Cost per Correct Answer**
   - *Metric:* $ spent / verified-correct output.

3. **Over-Routing Penalty**
   - *Definition:* How often does it search/verify unnecessarily?
   - *Metric:* # of tool calls on tasks that could be done safely in Tier 4.

---

### 13.5 High-Stakes Compliance Benchmarks (The Real Test)

Create a “High Stakes Test Set” (medical, legal, finance, safety). For each item define **mandatory primitives**.

1. **Mandatory Search Compliance**
   - Example rule: “Medical dosage questions MUST do retrieval + cross-reference.”
   - *Metric:* % of runs that follow the required protocol.

2. **Mandatory Verification Compliance**
   - Example rule: “Numeric claims MUST do Calculate + Validate_Units.”
   - *Metric:* % compliance.

3. **Audit Log Completeness**
   - *Metric:* Do we have a trace: query → spec → retrieval → verification → answer?

---

### 13.6 Suggested Benchmark Tasks (Starter Set)

Use ~200 prompts split across categories:
- **Missing variable** tasks (force Ask_User)
- **Stale knowledge** tasks (force Search)
- **Math/units** tasks (force Calculate + Validate_Units)
- **Contradiction** tasks (force Check_Consistency)
- **Ambiguous entity** tasks (force Resolve_Entity)
- **High-stakes** tasks (force Cross_Reference + citations)

For each prompt, build a gold annotation:
- Required primitives
- Which tier(s) must be invoked
- Minimal acceptable evidence

---

### 13.7 Passing Criteria (What “Good” Looks Like)

A system is “PCC-Ready” when:
- **Spec conformance** > 99%
- **Missing-fact hallucinations** < 1%
- **High-stakes protocol compliance** > 95%
- Tool argument correctness is high enough that humans rarely need to “fix JSON”

---

## 14. Roadmap to a v1 Prototype (PCC-Router System)

This roadmap assumes you want a **working prototype** (not a research paper) that can:
- convert queries into Primitive Specs,
- detect missing primitives,
- retrieve/verify as needed,
- store verified artifacts,
- and produce auditable traces.

### 14.0 Definition of “v1”
A v1 PCC system should reliably do **process compliance** on a small set of domains (e.g., math/units + factual retrieval + one high-stakes domain).

**v1 success criteria:**
- Spec conformance > 99%
- Missing-fact hallucinations < 1% on the benchmark
- High-stakes compliance > 95% on the benchmark
- Full trace available for every run: query → spec → checks → tool calls → verification → answer

---

### Week 1 — Lock the Contracts (Spec, Analyzer, Tickets)
**Goal:** Make the system “parseable” and deterministic.

**Deliverables:**
1. **Router Output Schema** (JSON contract)
   - `goal`, `required_primitives`, `missing`, `risk_flags`, `assumptions`, `suggested_routes`
2. **Primitive Library v0** (start with 30–50 primitives)
3. **PCC Analyzer v0** rules
   - missing parameter detection
   - missing fact detection (not in context/memory)
   - unknown primitive detection
   - basic risk classification (high-stakes categories)
4. **Routing Ticket format**
   - e.g. `{tier: 2, action: search, query: "..."}`

**Acceptance checks:**
- Router spec schema validates 100% for a small manual test set.
- Analyzer produces deterministic results for the same input.

---

### Week 2 — Build Tier 2 Retrieval + Memory (Grounding First)
**Goal:** Replace guessing with retrieval.

**Deliverables:**
1. **Retrieval module**
   - web search wrapper (or internal docs/db) + source capture
2. **Memory store**
   - minimal DB/JSON store with provenance
   - `Store(key, artifact, provenance)`
   - `Recall(key)`
3. **Grounding policy**
   - define “which claims require citations” (especially high-stakes)

**Acceptance checks:**
- Given prompts with missing facts, the system retrieves and cites sources.
- Memory recall works and reduces repeated searching.

---

### Week 3 — Add Tier 3 Verification (Stop ‘Correct Math on Wrong Inputs’)
**Goal:** Introduce a verifier/solver layer.

**Deliverables:**
1. **Verifier harness**
   - calculators, unit validators, code runner, simulation hooks (choose 1–2)
2. **Verification policies**
   - e.g. “numeric outputs must run Calculate + Validate_Units + Sanity_Check”
3. **Cross-reference**
   - minimum: 2-source check for high-stakes factual claims

**Acceptance checks:**
- Numeric tasks always route through verification.
- Contradiction prompts trigger `Check_Consistency` and/or cross-reference.

---

### Week 4 — Make the Router Reliable (Fine-tune to “Spec Mode”)
**Goal:** A small router that never drifts into answering.

**Deliverables:**
1. **Synthetic dataset generator**
   - create `{Query -> Primitive Spec + missing + risk}` examples
2. **SFT fine-tune** of a small model (or prompt-locked baseline if you can’t fine-tune yet)
3. **Router evaluation set**
   - spec conformance
   - gap detection
   - over-routing vs under-routing

**Acceptance checks:**
- Router spec conformance > 99%.
- Router reduces “tool misuse” and “missing fact hallucination” vs prompt-only.

---

### Week 5 — End-to-End Trace + Auditability (Make It Debuggable)
**Goal:** Make every step inspectable.

**Deliverables:**
1. **Trace format**
   - time, tokens, spec, analyzer report, tickets, tool results, verifier output, final answer
2. **Replay capability**
   - rerun the same trace to reproduce behavior
3. **Red-team harness**
   - prompts designed to force hallucination, missing variables, and policy bypass

**Acceptance checks:**
- Every run produces a complete trace.
- You can reproduce at least 90% of failures deterministically.

---

### Week 6 — Benchmarking + Iterate (Prove It Works)
**Goal:** Turn “cool demo” into measurable reliability.

**Deliverables:**
1. **Benchmark suite (200–500 prompts)** with gold annotations
   - required primitives
   - required tiers
   - required evidence
2. **Metrics dashboard**
   - hallucination rate
   - compliance rate
   - tool argument correctness
   - latency/cost
3. **Iteration loop**
   - update analyzer rules + router tuning based on failures

**Acceptance checks:**
- Hit the v1 success criteria targets (or show clear trendline).

---

### Minimal “v1 Stack” Recommendation (keep it buildable)
- Router LLM: small instruct model (fine-tuned for spec output)
- Analyzer: deterministic rules + schema validation
- Retrieval: one web search API + citation capture
- Verifier: calculator + unit checker (and optionally code runner)
- Memory: simple DB with provenance + recall
- Tracing: JSON traces + replay

---

If you want, tell me what environment you care about (local laptop vs cloud) and what your first target domain is (math, coding, medical, legal), and I can tune this roadmap into a **tight “first prototype” plan** with specific tool choices.


# The Verifier inside PCC-Router
Symbolic AI (specifically __Planners__) and __Code Parsers__ are the masters of breakdown.

1. __Classical Planners (HTN - Hierarchical Task Networks):__

   - *What they do:* You give them a goal ("Build House") and a library of methods ("Lay Brick", "Mix Cement"). They decompose the goal into a valid tree of atomic actions.
   - *Why they are good:* They are mathematically guaranteed to find missing prerequisites. If you need a hammer and don't have one, the planner fails *before* it starts.
   - *Limit:* They are brittle; you have to define the methods manually.

2. __Code Static Analysis (ASTs):__

   - *What they do:* A compiler (like TypeScript's) breaks code down into an Abstract Syntax Tree. It knows exactly that `x = y + 1` requires `y` to be defined (Pre-condition).
   - *Why they are good:* They catch "missing primitives" (undefined variables) instantly with 100% accuracy.

__The Hybrid Router Idea:__ Don't ask the LLM to "check gaps" in prose. Ask the LLM to __translate the query into a pseudo-code spec__, then run a __Symbolic Analyzer__ on that spec.

- *User:* "Calculate the orbit."
- *Small LLM:* `def orbit(mass, velocity): return ...`
- *Static Analyzer:* "Error: `mass` is undefined."
- *Router:* "Gap found. Ask user for Mass."

This uses the LLM for what it's good at (Translation) and the Symbolic tool for what it's good at (Completeness Check). __That__ is a robust Router.
