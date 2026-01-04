# AI Model Benchmarks: A Guide for CodeMaestro

To build a competitive AGI platform, we must understand how models are measured. Benchmarks are the "SAT scores" for AI models.

## 1. Coding & Engineering Benchmarks
*These are the most critical for CodeMaestro (Orion/Devon).*

### **SWE-bench (Software Engineering Benchmark)**
- **What it is:** The "Gold Standard" for autonomous coding agents.
- **What it tests:** Can the AI resolve *real-world GitHub issues*?
- **Task:** Given a codebase and a real issue description (from popular repos like Django, scikit-learn), the AI must generate a patch that passes new test cases.
- **Why it matters:** It tests **repo-level understanding**, navigation, and debugging, not just generating a single function.
- **Relevance:** This is exactly what Devon does. We should eventually run CodeMaestro against SWE-bench.

### **HumanEval (OpenAI)**
- **What it is:** A classic set of 164 Python programming problems.
- **What it tests:** Basic function generation from docstrings.
- **Task:** "Write a function that sums all even numbers in a list."
- **Why it matters:** Tests basic **syntax and logic** correctness.
- **Relevance:** Table stakes. If a model fails this, it can't code.

### **MBPP (Mostly Basic Python Programming)**
- **What it is:** Similar to HumanEval but with ~1,000 beginner-level problems.
- **What it tests:** Foundational coding knowledge.
- **Relevance:** Good for sanity checking smaller models.

### **LiveCodeBench**
- **What it is:** Problems from LeetCode/AtCoder contests *published after the model's training data cutoff*.
- **What it tests:** Ability to solve **novel problems** (generalization) rather than just regurgitating memorized solutions.
- **Relevance:** Proves the model can think, not just remember.

---

## 2. Reasoning & General Intelligence Benchmarks
*These matter for Orion (Planning/Orchestration).*

### **MMLU (Massive Multitask Language Understanding)**
- **What it is:** 57 subjects across STEM, humanities, and social sciences.
- **What it tests:** General **world knowledge** and problem-solving.
- **Relevance:** Helpful for the "Librarian" agent or understanding diverse domains (legal, medical) if we expand beyond coding.

### **GPQA (Google-Proof Q&A)**
- **What it is:** Extremely hard science/biology/physics questions written by experts.
- **What it tests:** Deep **reasoning capabilities** (harder than MMLU).
- **Relevance:** A proxy for how well the model can handle complex, multi-step logical deduction (crucial for debugging hard bugs).

### **MATH**
- **What it is:** High school and competition math problems.
- **What it tests:** Step-by-step **chain-of-thought** reasoning.
- **Relevance:** Models good at MATH are usually good at logical planning (CAP/RED).

---

## 3. Instruction Following & Chat Benchmarks
*These matter for User Experience.*

### **Chatbot Arena (LMSYS)**
- **What it is:** Elo rating based on human blind tests ("Model A vs Model B").
- **What it tests:** **Human preference**, helpfulness, and conversational style.
- **Relevance:** Tells us which models "feel" smart to interact with.

### **IFEval (Instruction Following Evaluation)**
- **What it is:** Tests ability to follow strict formatting constraints (e.g., "Write a response in JSON without markdown").
- **What it tests:** **Constraint satisfaction**.
- **Relevance:** Critical for our Tools. If Orion can't output valid JSON for `WritePlanTool`, the system breaks.

---

## Summary: What CodeMaestro Cares About

| Benchmark | Role | Why? |
| :--- | :--- | :--- |
| **SWE-bench** | **Devon** | Tests real-world engineering capability. |
| **HumanEval** | **Devon** | Tests syntax/basic logic baseline. |
| **GPQA / MATH** | **Orion** | Tests deep reasoning & planning logic. |
| **IFEval** | **System** | Tests reliability in using our JSON tools. |

**Strategy:**
We don't need to *train* models to beat these. We need to **select** models that score high on them (e.g., using Claude 3.5 Sonnet for Devon because it crushes SWE-bench, using o1/DeepSeek-R1 for Orion because they crush MATH/Reasoning).
